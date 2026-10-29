// エントリー詳細の「商品写真」を管理者が差し替え・追加・削除するときの決まり（画面と API で共有）。

/** 1商品に置ける写真の上限。応募フォームはメイン1＋サブ2だが、事務局があとから足せるよう広めにとる */
export const MAX_ENTRY_PHOTOS = 10;

/**
 * 1枚の上限。Vercel の関数が受け取れる本文は 4.5MB までなので、余裕をみて 4MB。
 * 画面側はこれを超える写真をブラウザで縮めてから送る。
 */
export const ENTRY_PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export const ENTRY_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface EntryPhoto {
  id: number;
  imageUrl: string;
  imageType: string; // "main" | "sub"
}

export function photoLabel(imageType: string): string {
  return imageType === "main" ? "メインビジュアル" : "サブ画像";
}
