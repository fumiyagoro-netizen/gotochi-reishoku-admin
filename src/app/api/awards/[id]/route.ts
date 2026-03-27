import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";

// PATCH: update award (name, isActive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  if (role !== "admin") {
    return NextResponse.json({ success: false, message: "管理者のみ実行できます" }, { status: 403 });
  }

  const { id } = await params;
  const user = await getUserFromRequest(request);
  const body = await request.json();

  const award = await prisma.award.findUnique({ where: { id: parseInt(id) } });
  if (!award) {
    return NextResponse.json({ success: false, message: "年度が見つかりません" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.name !== undefined && body.name !== award.name) {
    updateData.name = body.name;
    changes.push(`名前: ${award.name} → ${body.name}`);
  }

  if (body.isActive !== undefined && body.isActive !== award.isActive) {
    updateData.isActive = body.isActive;
    changes.push(`受付: ${award.isActive ? "ON" : "OFF"} → ${body.isActive ? "ON" : "OFF"}`);

    // If activating this award, deactivate all others
    if (body.isActive) {
      await prisma.award.updateMany({
        where: { id: { not: award.id } },
        data: { isActive: false },
      });
    }
  }

  if (body.entryStartDate !== undefined) {
    updateData.entryStartDate = body.entryStartDate ? new Date(body.entryStartDate) : null;
    changes.push(`受付開始: ${body.entryStartDate || "未設定"}`);
  }

  if (body.entryEndDate !== undefined) {
    updateData.entryEndDate = body.entryEndDate ? new Date(body.entryEndDate) : null;
    changes.push(`受付締切: ${body.entryEndDate || "未設定"}`);
  }

  if (body.notifyEmails !== undefined) {
    updateData.notifyEmails = body.notifyEmails;
    changes.push(`通知先: ${body.notifyEmails || "未設定"}`);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true, award });
  }

  const updated = await prisma.award.update({
    where: { id: award.id },
    data: updateData,
  });

  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "update",
    target: "award",
    targetId: String(award.id),
    detail: changes.join(", "),
  });

  return NextResponse.json({ success: true, award: updated });
}

// DELETE: delete award (only if no entries)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  if (role !== "admin") {
    return NextResponse.json({ success: false, message: "管理者のみ実行できます" }, { status: 403 });
  }

  const { id } = await params;
  const user = await getUserFromRequest(request);

  const award = await prisma.award.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { entries: true } } },
  });

  if (!award) {
    return NextResponse.json({ success: false, message: "年度が見つかりません" }, { status: 404 });
  }

  if (award._count.entries > 0) {
    return NextResponse.json(
      { success: false, message: `${award._count.entries}件のエントリーがあるため削除できません` },
      { status: 400 }
    );
  }

  await prisma.award.delete({ where: { id: award.id } });

  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "delete",
    target: "award",
    targetId: String(award.id),
    detail: `年度削除: ${award.name} (${award.year})`,
  });

  return NextResponse.json({ success: true });
}
