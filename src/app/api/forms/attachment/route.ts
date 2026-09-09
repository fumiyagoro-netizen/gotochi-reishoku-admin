import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import type { FormAnswers } from "@/lib/form-shared";

/**
 * 回答に添付されたファイルを事務局が開くためのルート。
 *
 * 添付は access:"private" で保存している（/api/forms/upload）ため、blob の URL を
 * そのままブラウザで開いても読めない。回答一覧はその URL を直接 <a href> にして
 * いたので、クリックしても開けない状態だった。ここで認証を通してから中身を
 * 中継する。
 *
 * url をクエリで受け取るが、任意の URL を取りに行く踏み台にならないよう、
 * 「実際にどれかの回答に保存されている URL であること」を必ず確認してから
 * 取得する。ホスト名の照合だけで済ませていない理由は、それだと同じ blob ストア
 * にある他用途のファイルまで引けてしまうため。
 */
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  // 回答一覧 (GET /api/forms/[id]/submissions) と同じ条件にそろえる —
  // 一覧が見える人は添付も開ける、が自然な粒度。
  if (!perms.canManageForms || !perms.canEdit) {
    return NextResponse.json(
      { success: false, message: "閲覧権限がありません" },
      { status: 403 }
    );
  }

  const url = request.nextUrl.searchParams.get("url") || "";
  if (!url) {
    return NextResponse.json({ success: false, message: "url が必要です" }, { status: 400 });
  }

  const submissions = await prisma.formSubmission.findMany({ select: { answers: true } });
  const isStoredAttachment = submissions.some((s) => {
    const answers = (s.answers as unknown as FormAnswers) || {};
    return Object.values(answers).some((v) =>
      Array.isArray(v) ? v.includes(url) : v === url
    );
  });

  // 存在しない添付と権限外を区別させないため、どちらも 404 で返す。
  if (!isStoredAttachment) {
    return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
  }

  try {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ success: false, message: "見つかりません" }, { status: 404 });
    }

    const filename = result.blob.pathname.split("/").pop() || "attachment";
    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/octet-stream",
        // inline: 画像やPDFはその場で見えた方が確認が早い。ブラウザが表示
        // できない形式は、この指定でも通常どおりダウンロードになる。
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Form attachment fetch error:", error);
    return NextResponse.json(
      { success: false, message: "ファイルの取得に失敗しました" },
      { status: 500 }
    );
  }
}
