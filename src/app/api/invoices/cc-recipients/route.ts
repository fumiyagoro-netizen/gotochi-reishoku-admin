import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";

// The addresses copied on a real invoice send (see
// src/app/api/invoices/[id]/send/route.ts). Exposed so the send modal can
// show them before the send: the CC is visible to the customer, and the send
// can't be taken back, so who else receives it should be on screen rather
// than implied.
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  if (!getPermissions(role).canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  const representatives = await prisma.user.findMany({
    where: { role: "representative", isActive: true },
    select: { email: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({
    success: true,
    ccRecipients: representatives.map((r) => r.email).filter(Boolean),
  });
}
