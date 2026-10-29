import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { fail, requireManage } from "@/lib/retail-api";
import { DECISION_LABELS, RESPONSE_LABELS, isDecision, isResponse, parseAwardIds } from "@/lib/retail-shared";

type Ctx = { params: Promise<{ id: string }> };

const TEXT_FIELDS = { respondentName: 100, respondentContact: 100, companyNote: 1000, staffMemo: 1000 } as const;
type TextField = keyof typeof TEXT_FIELDS;

// PATCH: 企画 × 商品の回答・確定を事務局が設定する（1件でも、チェックした複数件でも）。
// body: { entryIds: number[], set: { response?, decision?, respondentName?, respondentContact?, companyNote?, staffMemo? } }
// 行が無い商品は作る。回答を変えたら respondedAt を今にし「事務局が入力」にする
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;

    const campaignId = parseInt((await params).id);
    const campaign = Number.isInteger(campaignId)
      ? await prisma.retailCampaign.findUnique({ where: { id: campaignId } })
      : null;
    if (!campaign) return fail("企画が見つかりません", 404);

    const body = await request.json();
    const entryIds: number[] = Array.isArray(body.entryIds)
      ? [...new Set<number>(body.entryIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n)))]
      : [];
    const set = (body.set ?? {}) as Record<string, unknown>;
    if (entryIds.length === 0) return fail("商品を選んでください");
    if (entryIds.length > 500) return fail("一度に設定できるのは500件までです");
    if ("response" in set && !isResponse(set.response)) return fail("回答の値が不正です");
    if ("decision" in set && !isDecision(set.decision)) return fail("確定の値が不正です");

    // 対象 = 企画の年度の受賞商品、または既に行がある商品（対象年度から外れた記録）
    const awardIds = parseAwardIds(campaign.awardIds);
    const [eligible, existing] = await Promise.all([
      prisma.entry.findMany({
        where: { id: { in: entryIds }, awardId: { in: awardIds }, prizeLevel: { not: "" } },
        select: { id: true },
      }),
      prisma.retailCampaignItem.findMany({ where: { campaignId, entryId: { in: entryIds } } }),
    ]);
    const allowed = new Set([...eligible.map((e) => e.id), ...existing.map((i) => i.entryId)]);
    if (entryIds.some((id) => !allowed.has(id))) return fail("この企画の対象ではない商品が含まれています");
    const existingOf = new Map(existing.map((i) => [i.entryId, i]));

    const now = new Date();
    const changes: string[] = [];
    const results = await prisma.$transaction(
      entryIds.map((entryId) => {
        const before = existingOf.get(entryId);
        const data: Record<string, unknown> = {};
        if ("response" in set && set.response !== (before?.response ?? "")) {
          data.response = set.response;
          data.respondedAt = set.response ? now : null;
          data.respondedVia = set.response ? "staff" : "";
        }
        if ("decision" in set && set.decision !== (before?.decision ?? "")) {
          data.decision = set.decision;
          data.decidedAt = set.decision ? now : null;
        }
        for (const [key, max] of Object.entries(TEXT_FIELDS) as [TextField, number][]) {
          if (key in set) {
            const value = String(set[key] ?? "").trim().slice(0, max);
            if (value !== (before?.[key] ?? "")) data[key] = value;
          }
        }
        return prisma.retailCampaignItem.upsert({
          where: { campaignId_entryId: { campaignId, entryId } },
          update: data,
          create: { campaignId, entryId, ...data },
        });
      }),
    );

    if ("response" in set && isResponse(set.response)) changes.push(`企業の回答=${RESPONSE_LABELS[set.response]}`);
    if ("decision" in set && isDecision(set.decision)) changes.push(`事務局の確定=${DECISION_LABELS[set.decision]}`);
    for (const key of Object.keys(TEXT_FIELDS)) if (key in set) changes.push(key);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "retail_item",
      targetId: String(campaignId),
      detail: `流通企画 ${campaign.name}: ${changes.join(", ")}（商品ID: ${entryIds.join(",")}）`,
    });

    return NextResponse.json({
      success: true,
      items: results.map((i) => ({
        entryId: i.entryId,
        response: i.response,
        respondedAt: i.respondedAt?.toISOString() ?? null,
        respondedVia: i.respondedVia,
        respondentName: i.respondentName,
        respondentContact: i.respondentContact,
        companyNote: i.companyNote,
        decision: i.decision,
        decidedAt: i.decidedAt?.toISOString() ?? null,
        staffMemo: i.staffMemo,
      })),
    });
  } catch (err) {
    console.error("Update campaign items error:", err);
    return fail("保存に失敗しました", 500);
  }
}
