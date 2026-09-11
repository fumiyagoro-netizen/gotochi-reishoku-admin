import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { GRAND_PRIX_TITLE, GRAND_PRIX_PRIZE_LEVEL } from "@/lib/prize-shared";

// グランプリの付け外し（EntryTitle の name="グランプリ"）。受賞の設定と同じ canSetPrize で守る。
// グランプリは最高金賞の中から1品なので、最高金賞でない商品には付けられない。
// 同じ年度の別の商品に付いていたグランプリは外す（1年度に1品）。外した商品名は返して画面に出す。
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    if (!getPermissions(role).canSetPrize) {
      return NextResponse.json(
        { success: false, message: "受賞設定の権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const entryId = parseInt(id);
    const body = await request.json().catch(() => ({}));
    if (typeof body.grandPrix !== "boolean") {
      return NextResponse.json(
        { success: false, message: "grandPrix（true / false）を指定してください" },
        { status: 400 }
      );
    }
    const on: boolean = body.grandPrix;

    const entry = await prisma.entry.findUnique({
      where: { id: entryId },
      select: { id: true, awardId: true, productName: true, companyName: true, prizeLevel: true },
    });
    if (!entry) {
      return NextResponse.json(
        { success: false, message: "エントリーが見つかりません" },
        { status: 404 }
      );
    }
    if (on && entry.prizeLevel !== GRAND_PRIX_PRIZE_LEVEL) {
      return NextResponse.json(
        { success: false, message: "グランプリは最高金賞の商品にだけ付けられます" },
        { status: 400 }
      );
    }

    const replaced: string[] = [];
    await prisma.$transaction(async (tx) => {
      if (on) {
        const others = await tx.entryTitle.findMany({
          where: { name: GRAND_PRIX_TITLE, entryId: { not: entryId }, entry: { awardId: entry.awardId } },
          include: { entry: { select: { productName: true } } },
        });
        for (const o of others) replaced.push(o.entry.productName);
        if (others.length > 0) {
          await tx.entryTitle.deleteMany({ where: { id: { in: others.map((o) => o.id) } } });
        }
        const exists = await tx.entryTitle.findFirst({ where: { entryId, name: GRAND_PRIX_TITLE } });
        if (!exists) {
          await tx.entryTitle.create({ data: { entryId, name: GRAND_PRIX_TITLE } });
        }
      } else {
        await tx.entryTitle.deleteMany({ where: { entryId, name: GRAND_PRIX_TITLE } });
      }
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "grand_prix",
      target: "entry",
      targetId: String(entryId),
      detail:
        `${entry.productName}（${entry.companyName}）: グランプリを${on ? "付与" : "取消"}` +
        (replaced.length > 0 ? `（${replaced.join("、")} から付け替え）` : ""),
    });

    return NextResponse.json({ success: true, grandPrix: on, replaced });
  } catch (error) {
    console.error("Grand prix update error:", error);
    return NextResponse.json(
      { success: false, message: "グランプリの保存中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
