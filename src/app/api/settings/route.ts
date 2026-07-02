import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";
import { getEmailFooterSettings, setSetting } from "@/lib/settings";

export async function GET() {
  const footer = await getEmailFooterSettings();
  return NextResponse.json({ success: true, settings: footer });
}

export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    if (role !== "admin") {
      return NextResponse.json(
        { success: false, message: "管理者のみ設定を変更できます" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const keyMap: Record<string, string> = {
      senderName: "sender_name",
      orgName: "org_name",
      postalAddress: "postal_address",
      contactEmail: "contact_email",
      contactTel: "contact_tel",
    };

    const changes: string[] = [];
    for (const [bodyKey, settingKey] of Object.entries(keyMap)) {
      if (bodyKey in body) {
        await setSetting(settingKey, String(body[bodyKey] ?? ""));
        changes.push(settingKey);
      }
    }

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update_settings",
      target: "setting",
      detail: `フッター設定更新: ${changes.join(", ")}`,
    });

    const settings = await getEmailFooterSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { success: false, message: "設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}
