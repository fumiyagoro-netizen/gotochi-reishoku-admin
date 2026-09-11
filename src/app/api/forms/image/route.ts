import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { FORM_IMAGE_PREFIX } from "@/lib/form-shared";

const MAX_BYTES = 5 * 1024 * 1024;
/** 受け付ける画像の種類と、保存するときの拡張子。拡張子はファイル名からではなく種類から決める
 *  （ファイル名の拡張子を信じると、中継ルートが画像以外の Content-Type で返しかねない）。 */
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * 画像ブロック用のアップロード。回答者の添付を受ける /api/forms/upload とは
 * 別ルートにしている理由は2つ:
 *
 * 1. 見せる相手が違う。ここで上げた画像は公開フォームを開いた誰にでも表示される。
 *    添付の方は事務局しか見ない。Blob ストアが private 設定（access:"public" の保存は
 *    "Cannot use public access on a private store" で拒否される）なので、どちらも private で
 *    保存するが、画像は forms/images/ 配下に置き、ログインなしで読める中継ルート
 *    （/api/forms/image/view）はこの配下だけを返す。同じ場所に置くと、回答者の添付まで
 *    誰でも読めてしまう。
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

    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
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

    const blob = await put(
      `${FORM_IMAGE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`,
      file,
      { access: "private", contentType: file.type }
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
