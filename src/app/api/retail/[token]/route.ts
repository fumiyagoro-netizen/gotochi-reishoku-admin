import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { loadRetailPage } from "@/lib/retail";
import { RESPONSE_LABELS, isResponse } from "@/lib/retail-shared";

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

// POST: 申請ページ（/retail/<token>）からの回答。ログインなし（src/lib/public-paths.ts）。
// token の担当者が答える商品 × 募集中で締切前の企画だけを受け付ける（loadRetailPage と同じ範囲）
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const page = await loadRetailPage(token);
    if (!page) return fail("このページは開けません。案内メールのURLをご確認ください", 404);

    const body = await request.json().catch(() => ({}));
    const respondentName = String(body.respondentName ?? "").trim().slice(0, 100);
    const respondentContact = String(body.respondentContact ?? "").trim().slice(0, 100);
    if (!respondentName) return fail("ご回答者のお名前を入力してください");
    if (!respondentContact) return fail("ご回答者の電話番号を入力してください");
    const notes = (body.notes && typeof body.notes === "object" ? body.notes : {}) as Record<string, unknown>;

    const answerable = new Set(page.campaigns.filter((c) => c.answerable).map((c) => c.id));
    const allowed = new Set(
      page.products.flatMap((p) => p.answers.filter((a) => answerable.has(a.campaignId)).map((a) => `${a.campaignId}:${p.id}`)),
    );
    const raw: unknown[] = Array.isArray(body.answers) ? body.answers.slice(0, 1000) : [];
    const answers = raw.map((a) => {
      const o = (a ?? {}) as Record<string, unknown>;
      return { campaignId: Number(o.campaignId), entryId: Number(o.entryId), response: o.response };
    });
    if (answers.length === 0) return fail("「参加を希望する」か「参加しない」を、1つ以上選んでください");
    if (answers.some((a) => !isResponse(a.response) || a.response === "")) return fail("回答の値が不正です");
    if (answers.some((a) => !allowed.has(`${a.campaignId}:${a.entryId}`))) {
      return fail("受付が終了した企画が含まれています。ページを読み込み直してから、もう一度送信してください");
    }

    const existing = await prisma.retailCampaignItem.findMany({
      where: { OR: answers.map((a) => ({ campaignId: a.campaignId, entryId: a.entryId })) },
    });
    const existingOf = new Map(existing.map((i) => [`${i.campaignId}:${i.entryId}`, i]));
    const now = new Date();

    await prisma.$transaction([
      ...answers.map((a) => {
        const before = existingOf.get(`${a.campaignId}:${a.entryId}`);
        const companyNote = String(notes[String(a.entryId)] ?? "").trim().slice(0, 1000);
        const changed = !before || before.response !== a.response || before.companyNote !== companyNote;
        const data = {
          response: a.response as string,
          respondedVia: "form",
          respondentName,
          respondentContact,
          companyNote,
          // 同じ内容の送り直しでは回答日時を動かさない（「確定のあとに回答が変わりました」を誤って出さない）
          ...(changed || !before?.respondedAt ? { respondedAt: now } : {}),
        };
        return prisma.retailCampaignItem.upsert({
          where: { campaignId_entryId: { campaignId: a.campaignId, entryId: a.entryId } },
          update: data,
          create: { campaignId: a.campaignId, entryId: a.entryId, ...data },
        });
      }),
      prisma.retailInvite.update({ where: { token }, data: { lastAnsweredAt: now } }),
    ]);

    const nameOfCampaign = new Map(page.campaigns.map((c) => [c.id, c.name]));
    const nameOfProduct = new Map(page.products.map((p) => [p.id, p.productName]));
    await writeAuditLog({
      userEmail: page.inviteEmail,
      action: "retail_answer",
      target: "retail_invite",
      detail:
        `申請ページから回答（${respondentName}）: ` +
        answers
          .map((a) => `${nameOfProduct.get(a.entryId)}×${nameOfCampaign.get(a.campaignId)}=${RESPONSE_LABELS[a.response as "yes" | "no"]}`)
          .join(", "),
    });

    return NextResponse.json({ success: true, count: answers.length });
  } catch (err) {
    console.error("Retail answer error:", err);
    return fail("送信できませんでした。時間をおいてもう一度お試しください", 500);
  }
}
