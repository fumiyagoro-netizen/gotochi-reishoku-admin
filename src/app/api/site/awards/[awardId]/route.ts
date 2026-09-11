import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jstDateStringToEndOfDayUtc, utcToJstDateInputValue } from "@/lib/award-dates";

// 年度ごとの公開サイト設定（docs/site-migration/README.md §3 の2フラグ）。サイト管理（canManageSite）だけ。
//   winnersPublished: 受賞商品を公開（発表時に ON、以後ずっと ON）
//   isFeatured:       最新の受賞発表として特別枠に掲載（同時に1年度だけ）
//   featuredUntil:    "YYYY-MM-DD"（JST のその日の終わりまで）。過ぎたら特別枠は OFF として扱う
// ルール: 特別枠に載せるなら受賞商品も公開にする／非公開にするなら特別枠も外す／
//         特別枠を ON にしたら他の年度の特別枠は OFF にする／ON にするときの終了日は今日より後
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ awardId: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    if (!getPermissions(role).canManageSite) {
      return NextResponse.json(
        { success: false, message: "サイト管理の権限がありません" },
        { status: 403 }
      );
    }

    const { awardId: rawId } = await params;
    const awardId = parseInt(rawId);
    const body = await request.json().catch(() => ({}));

    for (const key of ["winnersPublished", "isFeatured"] as const) {
      if (key in body && typeof body[key] !== "boolean") {
        return NextResponse.json(
          { success: false, message: `${key} は true / false で指定してください` },
          { status: 400 }
        );
      }
    }

    const award = await prisma.award.findUnique({ where: { id: awardId }, select: { id: true, year: true } });
    if (!award) {
      return NextResponse.json(
        { success: false, message: "年度が見つかりません" },
        { status: 404 }
      );
    }

    const current = await prisma.siteAwardSettings.findUnique({ where: { awardId } });

    let featuredUntil = current?.featuredUntil ?? null;
    if ("featuredUntil" in body) {
      if (body.featuredUntil) {
        featuredUntil = jstDateStringToEndOfDayUtc(String(body.featuredUntil));
        if (!featuredUntil) {
          return NextResponse.json(
            { success: false, message: "終了日は YYYY-MM-DD の形で指定してください" },
            { status: 400 }
          );
        }
      } else {
        featuredUntil = null;
      }
    }

    let winnersPublished: boolean = body.winnersPublished ?? current?.winnersPublished ?? false;
    let isFeatured: boolean = body.isFeatured ?? current?.isFeatured ?? false;
    if (body.isFeatured === true) winnersPublished = true;
    if (body.winnersPublished === false) isFeatured = false;

    // 特別枠を ON にする操作（または ON のまま終了日を変える操作）では、終了日が未来であること
    if (isFeatured && (body.isFeatured === true || "featuredUntil" in body)) {
      if (!featuredUntil || featuredUntil.getTime() <= Date.now()) {
        return NextResponse.json(
          { success: false, message: "特別枠の終了日は、今日より後の日付にしてください" },
          { status: 400 }
        );
      }
    }

    const turnedOff: number[] = [];
    await prisma.$transaction(async (tx) => {
      if (isFeatured) {
        const others = await tx.siteAwardSettings.findMany({
          where: { isFeatured: true, awardId: { not: awardId } },
          include: { award: { select: { year: true } } },
        });
        for (const o of others) turnedOff.push(o.award.year);
        if (others.length > 0) {
          await tx.siteAwardSettings.updateMany({
            where: { id: { in: others.map((o) => o.id) } },
            data: { isFeatured: false },
          });
        }
      }
      await tx.siteAwardSettings.upsert({
        where: { awardId },
        create: { awardId, winnersPublished, isFeatured, featuredUntil },
        update: { winnersPublished, isFeatured, featuredUntil },
      });
    });

    const changes: string[] = [];
    const before = { wp: current?.winnersPublished ?? false, f: current?.isFeatured ?? false, u: current?.featuredUntil ?? null };
    if (before.wp !== winnersPublished) changes.push(`受賞商品を${winnersPublished ? "公開" : "非公開"}`);
    if (before.f !== isFeatured) changes.push(`特別枠を${isFeatured ? "ON" : "OFF"}`);
    if (utcToJstDateInputValue(before.u) !== utcToJstDateInputValue(featuredUntil)) {
      changes.push(`特別枠の終了日: ${utcToJstDateInputValue(featuredUntil) || "なし"}`);
    }
    if (turnedOff.length > 0) changes.push(`${turnedOff.join("・")}年度の特別枠をOFF`);

    if (changes.length > 0) {
      const user = await getUserFromRequest(request);
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "site_award",
        target: "award",
        targetId: String(awardId),
        detail: `${award.year}年度: ${changes.join("、")}`,
      });
    }

    return NextResponse.json({
      success: true,
      settings: { winnersPublished, isFeatured, featuredUntil: utcToJstDateInputValue(featuredUntil) },
      turnedOff,
    });
  } catch (error) {
    console.error("Site award settings error:", error);
    return NextResponse.json(
      { success: false, message: "保存中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
