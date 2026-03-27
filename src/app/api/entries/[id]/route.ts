import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const EDITABLE_FIELDS = [
  "companyName",
  "department",
  "contactLastName",
  "contactFirstName",
  "email",
  "phone",
  "productName",
  "productCategory",
  "price",
  "purchaseLocation",
  "referenceUrl",
  "tradeShowExhibition",
  "retailPartnership",
  "localAppeal",
  "tasteAppeal",
  "packageAppeal",
  "cookingMethod",
  "otherAppeal",
  "bacteriaInspection",
  "expirationInspection",
  "manufacturingLicense",
  "entryProductLicense",
  "hygieneManager",
  "remarks",
  "prizeLevel",
  "reviewStatus",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    const body = await request.json();

    if (!perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    if ("prizeLevel" in body && !perms.canSetPrize) {
      return NextResponse.json(
        { success: false, message: "受賞設定の権限がありません" },
        { status: 403 }
      );
    }

    if ("reviewStatus" in body && !perms.canSetPrize) {
      return NextResponse.json(
        { success: false, message: "審査状況設定の権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const entryId = parseInt(id);

    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "エントリーが見つかりません" },
        { status: 404 }
      );
    }

    const data: Record<string, string> = {};
    const changes: string[] = [];
    for (const key of EDITABLE_FIELDS) {
      if (key in body) {
        const oldVal = String((entry as Record<string, unknown>)[key] || "");
        const newVal = String(body[key]);
        if (oldVal !== newVal) {
          changes.push(`${key}: "${oldVal}" → "${newVal}"`);
        }
        data[key] = newVal;
      }
    }

    const updated = await prisma.entry.update({
      where: { id: entryId },
      data,
    });

    // Audit log
    if (changes.length > 0) {
      const user = await getUserFromRequest(request);
      const isPrize = "prizeLevel" in body && Object.keys(body).length === 1;
      const isReview = "reviewStatus" in body && Object.keys(body).length === 1;
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: isPrize ? "prize" : isReview ? "review" : "update",
        target: "entry",
        targetId: String(entryId),
        detail: `${entry.productName}（${entry.companyName}）: ${changes.join(", ")}`,
      });
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json(
      { success: false, message: "更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);

    if (!perms.canDelete) {
      return NextResponse.json(
        { success: false, message: "削除権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const entryId = parseInt(id);

    const entry = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "エントリーが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.entry.delete({ where: { id: entryId } });

    // Audit log
    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "delete",
      target: "entry",
      targetId: String(entryId),
      detail: `${entry.productName}（${entry.companyName}）を削除`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { success: false, message: "削除中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
