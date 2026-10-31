import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { fail, requireManage } from "@/lib/retail-api";
import { DECISION_LABELS, RESPONSE_LABELS, isDecision, isResponse, parseAwardIds } from "@/lib/retail-shared";

type Ctx = { params: Promise<{ id: string }> };

const TEXT_FIELDS = { respondentName: 100, respondentContact: 100, companyNote: 1000, staffMemo: 1000 } as const;
type TextField = keyof typeof TEXT_FIELDS;

type Campaign = NonNullable<Awaited<ReturnType<typeof prisma.retailCampaign.findUnique>>>;
type User = { userId?: number; email?: string } | null | undefined;

/** 対象 = 企画の年度の受賞商品、または既に行がある商品（対象年度から外れた記録）。外れた商品があれば null */
async function loadExisting(campaign: Campaign, entryIds: number[]) {
  const [eligible, existing] = await Promise.all([
    prisma.entry.findMany({
      where: { id: { in: entryIds }, awardId: { in: parseAwardIds(campaign.awardIds) }, prizeLevel: { not: "" } },
      select: { id: true },
    }),
    prisma.retailCampaignItem.findMany({ where: { campaignId: campaign.id, entryId: { in: entryIds } } }),
  ]);
  const allowed = new Set([...eligible.map((e) => e.id), ...existing.map((i) => i.entryId)]);
  if (entryIds.some((id) => !allowed.has(id))) return null;
  return new Map(existing.map((i) => [i.entryId, i]));
}

// PATCH: 企画 × 商品の回答・確定を事務局が設定する。2つの形を受け付ける
// - { decisions: [{ entryId, decision }] } … 「採用・見送りを編集」の画面で選んだ変更をまとめて保存する（商品ごとに値が違う）
// - { entryIds: number[], set: { response?, decision?, respondentName?, respondentContact?, companyNote?, staffMemo? } }
//   … 1件の回答の代理入力など（同じ値を設定）
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
    if (Array.isArray(body.decisions)) return saveDecisions(campaign, body.decisions, user);

    const entryIds: number[] = Array.isArray(body.entryIds)
      ? [...new Set<number>(body.entryIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n)))]
      : [];
    const set = (body.set ?? {}) as Record<string, unknown>;
    if (entryIds.length === 0) return fail("商品を選んでください");
    if (entryIds.length > 500) return fail("一度に設定できるのは500件までです");
    if ("response" in set && !isResponse(set.response)) return fail("回答の値が不正です");
    if ("decision" in set && !isDecision(set.decision)) return fail("確定の値が不正です");

    const existingOf = await loadExisting(campaign, entryIds);
    if (!existingOf) return fail("この企画の対象ではない商品が含まれています");

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

    return NextResponse.json({ success: true, items: results.map(toItemJson) });
  } catch (err) {
    console.error("Update campaign items error:", err);
    return fail("保存に失敗しました", 500);
  }
}

type ItemRecord = Awaited<ReturnType<typeof prisma.retailCampaignItem.upsert>>;

function toItemJson(i: ItemRecord) {
  return {
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
  };
}

/** 採用・見送りの変更をまとめて保存する（すべて保存するか、1件も保存しないか） */
async function saveDecisions(campaign: Campaign, raw: unknown[], user: User) {
  // 同じ商品が2回あれば後のほうを使う
  const wanted = new Map<number, string>();
  for (const v of raw) {
    const o = (v ?? {}) as Record<string, unknown>;
    const entryId = Number(o.entryId);
    if (!Number.isInteger(entryId)) return fail("商品の指定が不正です");
    if (!isDecision(o.decision)) return fail("確定の値が不正です");
    wanted.set(entryId, o.decision);
  }
  if (wanted.size === 0) return fail("変更がありません");
  if (wanted.size > 500) return fail("一度に保存できるのは500件までです");

  const entryIds = [...wanted.keys()];
  const existingOf = await loadExisting(campaign, entryIds);
  if (!existingOf) return fail("この企画の対象ではない商品が含まれています");

  // 保存されている値と同じものは書かない（決めた日時を動かさない）
  const changed = entryIds.filter((id) => wanted.get(id) !== (existingOf.get(id)?.decision ?? ""));
  const now = new Date();
  const results = await prisma.$transaction(
    changed.map((entryId) => {
      const decision = wanted.get(entryId)!;
      const data = { decision, decidedAt: decision ? now : null };
      return prisma.retailCampaignItem.upsert({
        where: { campaignId_entryId: { campaignId: campaign.id, entryId } },
        update: data,
        create: { campaignId: campaign.id, entryId, ...data },
      });
    }),
  );

  if (changed.length > 0) {
    const names = new Map(
      (await prisma.entry.findMany({ where: { id: { in: changed } }, select: { id: true, productName: true } })).map(
        (e) => [e.id, e.productName],
      ),
    );
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "retail_item",
      targetId: String(campaign.id),
      detail:
        `流通企画 ${campaign.name}: 採用・見送りを変更 ` +
        changed
          .map((id) => {
            const d = wanted.get(id)! as keyof typeof DECISION_LABELS;
            return `${names.get(id) ?? id}=${DECISION_LABELS[d]}`;
          })
          .join(", "),
    });
  }

  return NextResponse.json({ success: true, count: changed.length, items: results.map(toItemJson) });
}
