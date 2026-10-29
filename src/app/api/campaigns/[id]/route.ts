import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { fail, parseCampaignInput, requireManage } from "@/lib/retail-api";
import { CAMPAIGN_STATUS_LABELS, formatJstDate, isCampaignStatus } from "@/lib/retail-shared";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;

    const campaignId = parseInt((await params).id);
    const before = Number.isInteger(campaignId)
      ? await prisma.retailCampaign.findUnique({ where: { id: campaignId } })
      : null;
    if (!before) return fail("企画が見つかりません", 404);

    const input = await parseCampaignInput(await request.json());
    if (typeof input === "string") return fail(input);

    const campaign = await prisma.retailCampaign.update({ where: { id: campaignId }, data: input });

    const label = (s: string) => (isCampaignStatus(s) ? CAMPAIGN_STATUS_LABELS[s] : s);
    const changes: string[] = [];
    if (before.name !== campaign.name) changes.push(`企画名 "${before.name}" → "${campaign.name}"`);
    if (before.status !== campaign.status) changes.push(`状態 ${label(before.status)} → ${label(campaign.status)}`);
    if (JSON.stringify(before.awardIds) !== JSON.stringify(campaign.awardIds)) changes.push("対象年度");
    if (before.period !== campaign.period) changes.push("実施時期");
    if (formatJstDate(before.deadline) !== formatJstDate(campaign.deadline)) {
      changes.push(`回答締切 ${formatJstDate(before.deadline) || "なし"} → ${formatJstDate(campaign.deadline) || "なし"}`);
    }
    if (before.description !== campaign.description) changes.push("企業向けの説明");
    if (before.memo !== campaign.memo) changes.push("事務局メモ");
    if (changes.length > 0) {
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "update",
        target: "retail_campaign",
        targetId: String(campaignId),
        detail: `流通企画 ${campaign.name}: ${changes.join(", ")}`,
      });
    }
    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    console.error("Update campaign error:", err);
    return fail("保存に失敗しました", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;

    const campaignId = parseInt((await params).id);
    const campaign = Number.isInteger(campaignId)
      ? await prisma.retailCampaign.findUnique({ where: { id: campaignId }, include: { _count: { select: { items: true } } } })
      : null;
    if (!campaign) return fail("企画が見つかりません", 404);

    // 回答・確定（RetailCampaignItem）は onDelete: Cascade で一緒に消える
    await prisma.retailCampaign.delete({ where: { id: campaignId } });
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "retail_campaign",
      targetId: String(campaignId),
      detail: `流通企画を削除: ${campaign.name}（回答・確定 ${campaign._count.items}件も削除）`,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete campaign error:", err);
    return fail("削除に失敗しました", 500);
  }
}
