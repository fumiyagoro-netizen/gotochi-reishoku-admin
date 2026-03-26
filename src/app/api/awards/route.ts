import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getRoleFromRequest } from "@/lib/role";
import { writeAuditLog } from "@/lib/audit";

// GET: list all awards
export async function GET() {
  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    include: {
      _count: { select: { entries: true } },
    },
  });
  return NextResponse.json(awards);
}

// POST: create a new award
export async function POST(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  if (role !== "admin") {
    return NextResponse.json({ success: false, message: "管理者のみ実行できます" }, { status: 403 });
  }

  const user = await getUserFromRequest(request);
  const body = await request.json();

  if (!body.year || !body.name) {
    return NextResponse.json({ success: false, message: "年度と名前は必須です" }, { status: 400 });
  }

  // Check duplicate year
  const existing = await prisma.award.findUnique({ where: { year: body.year } });
  if (existing) {
    return NextResponse.json({ success: false, message: `${body.year}年度は既に存在します` }, { status: 400 });
  }

  const award = await prisma.award.create({
    data: {
      year: body.year,
      name: body.name,
      isActive: body.isActive || false,
    },
  });

  // If this award is set active, deactivate others
  if (award.isActive) {
    await prisma.award.updateMany({
      where: { id: { not: award.id } },
      data: { isActive: false },
    });
  }

  await writeAuditLog({
    userId: user?.userId,
    userEmail: user?.email,
    action: "create",
    target: "award",
    targetId: String(award.id),
    detail: `年度作成: ${award.name} (${award.year})`,
  });

  return NextResponse.json({ success: true, award });
}
