import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

async function unsubscribe(email: string) {
  await prisma.suppression.upsert({
    where: { email },
    update: {},
    create: { email, reason: "unsubscribe" },
  });

  await prisma.contact.updateMany({
    where: { email },
    data: { subscribed: false },
  });

  await writeAuditLog({
    action: "unsubscribe",
    target: "contact",
    detail: `配信停止: ${email}`,
  });
}

// GET is intentionally read-only: mail clients / link scanners prefetch
// GET links, which previously caused unintended unsubscribes. The
// /unsubscribe page (linked from emails) reads this via GET but only shows
// a confirmation screen; it never mutates on GET.
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "配信停止には確認画面での操作が必要です。/unsubscribe のリンクからアクセスしてください",
    },
    { status: 405 }
  );
}

// POST: actual unsubscribe action, triggered by the confirmation button on
// the /unsubscribe page (a plain form submission, no auth required — the
// page itself is the confirmation step).
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let email = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}) as Record<string, unknown>);
    email = typeof body.email === "string" ? body.email : "";
  } else {
    const form = await request.formData();
    email = (form.get("email") as string) || "";
  }
  email = email.trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { success: false, message: "メールアドレスが指定されていません" },
      { status: 400 }
    );
  }

  await unsubscribe(email);

  // Redirect back to the public page so it can show the same completion
  // message as before (POST-redirect-GET pattern).
  const redirectUrl = new URL("/unsubscribe", request.url);
  redirectUrl.searchParams.set("email", email);
  redirectUrl.searchParams.set("done", "1");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
