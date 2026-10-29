import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { fail, requireManage } from "@/lib/retail-api";
import { isValidEmail, normalizeEmail } from "@/lib/retail-shared";

type Ctx = { params: Promise<{ entryId: string }> };

async function findWinner(entryIdRaw: string) {
  const entryId = parseInt(entryIdRaw);
  if (!Number.isInteger(entryId)) return null;
  return prisma.entry.findFirst({
    where: { id: entryId, prizeLevel: { not: "" } },
    select: { id: true, productName: true, email: true, retailContact: true },
  });
}

// PUT: 商品の案内先（流通企画に回答する担当者）を差し替える。エントリー本体の担当者・アドレスは変えない
export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;
    const entry = await findWinner((await params).entryId);
    if (!entry) return fail("受賞商品が見つかりません", 404);

    const body = await request.json();
    const email = normalizeEmail(String(body.email ?? ""));
    const name = String(body.name ?? "").trim().slice(0, 100);
    if (!isValidEmail(email)) return fail("メールアドレスが正しくありません");

    // エントリーと同じアドレスに戻すなら、差し替えを外すのと同じ
    if (email === normalizeEmail(entry.email) && !name) {
      await prisma.retailEntryContact.deleteMany({ where: { entryId: entry.id } });
    } else {
      await prisma.retailEntryContact.upsert({
        where: { entryId: entry.id },
        update: { email, name },
        create: { entryId: entry.id, email, name },
      });
    }
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "retail_contact",
      targetId: String(entry.id),
      detail: `流通企画の案内先: ${entry.productName} ${entry.retailContact?.email ?? entry.email} → ${email}${name ? `（${name}）` : ""}`,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update retail contact error:", err);
    return fail("保存に失敗しました", 500);
  }
}

// DELETE: 差し替えを外し、エントリーのアドレスの担当者に戻す
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;
    const entry = await findWinner((await params).entryId);
    if (!entry) return fail("受賞商品が見つかりません", 404);

    await prisma.retailEntryContact.deleteMany({ where: { entryId: entry.id } });
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "update",
      target: "retail_contact",
      targetId: String(entry.id),
      detail: `流通企画の案内先を元に戻す: ${entry.productName} → ${entry.email}`,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete retail contact error:", err);
    return fail("保存に失敗しました", 500);
  }
}
