import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";
import { getInvoiceIssuerSettings, setSetting } from "@/lib/settings";

// Deliberately its own route (not folded into /api/settings), since it
// reads/writes a completely separate set of Setting keys (invoice_* —
// see src/lib/settings.ts) for a different purpose (what's printed on an
// invoice PDF vs. the email-footer settings /api/settings serves). Kept
// admin-only, same as the /settings page as a whole (src/app/settings/
// page.tsx) — representative's role description explicitly excludes "設定"
// (ROLE_DESCRIPTIONS in src/lib/role-shared.ts), even though representative
// does carry canManageInvoices for the invoice feature itself.
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  if (role !== "admin") {
    return NextResponse.json({ success: false, message: "権限がありません" }, { status: 403 });
  }

  const settings = await getInvoiceIssuerSettings();
  return NextResponse.json({ success: true, settings });
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
      issuerName: "invoice_issuer_name",
      postalAddress: "invoice_issuer_postal_address",
      email: "invoice_issuer_email",
      registrationNumber: "invoice_registration_number",
      bankInfo: "invoice_bank_info",
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
      detail: `請求書発行者情報更新: ${changes.join(", ")}`,
    });

    const settings = await getInvoiceIssuerSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Update invoice settings error:", error);
    return NextResponse.json(
      { success: false, message: "設定の保存に失敗しました" },
      { status: 500 }
    );
  }
}
