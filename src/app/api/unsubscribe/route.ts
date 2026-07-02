import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

// GET: public unsubscribe endpoint, no auth required
export async function GET(request: NextRequest) {
  const email = (request.nextUrl.searchParams.get("email") || "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { success: false, message: "メールアドレスが指定されていません" },
      { status: 400 }
    );
  }

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

  return NextResponse.json({ success: true, email });
}
