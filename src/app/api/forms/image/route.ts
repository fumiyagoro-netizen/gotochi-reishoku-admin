import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getRoleFromRequest, getPermissions } from "@/lib/role";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

/**
 * 画像ブロック用のアップロード。回答者の添付を受ける /api/forms/upload とは
 * 別ルートにしている理由は2つ:
 *
 * 1. access が違う。ここで上げた画像は公開フォームを開いた誰にでも表示される
 *    ので "public" でなければならない。添付の方は事務局しか見ないので "private"。
 *    同じルートで両方扱うと、取り違えたときに回答者の添付が公開されてしまう。
 * 2. 権限が違う。/api/forms/upload はログインしていない回答者が使うため認証が
 *    ないが、こちらはフォームを編集できる人だけに限る。
 */
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    if (!getPermissions(role).canManageForms) {
      return NextResponse.json(
        { success: false, message: "フォームを編集する権限がありません" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, message: "ファイルが見つかりません" },
        { status: 400 }
      );
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "画像ファイル（PNG / JPEG / GIF / WebP / SVG）を選んでください" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: "画像サイズは5MB以下にしてください" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "png";
    const blob = await put(
      `forms/images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      file,
      { access: "public" }
    );

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error("Form image upload error:", error);
    return NextResponse.json(
      { success: false, message: "画像のアップロードに失敗しました" },
      { status: 500 }
    );
  }
}
