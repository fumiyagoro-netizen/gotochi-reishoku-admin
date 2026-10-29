import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { fail, parseCampaignInput, requireManage } from "@/lib/retail-api";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;

    const input = await parseCampaignInput(await request.json());
    if (typeof input === "string") return fail(input);

    const campaign = await prisma.retailCampaign.create({ data: input });
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "retail_campaign",
      targetId: String(campaign.id),
      detail: `流通企画を追加: ${campaign.name}`,
    });
    return NextResponse.json({ success: true, campaign });
  } catch (err) {
    console.error("Create campaign error:", err);
    return fail("保存に失敗しました", 500);
  }
}
