/**
 * お知らせ本文の書き方（管理画面の編集欄と公開サイトの両方で使う）。
 *
 * 本文は文字のまま保存し、画像は1行まるごとの目印で入れる：
 *   [画像:https://xxxx.private.blob.vercel-storage.com/site/news/1697-abc.webp 会場の様子]
 * 「画像:」のあとが保存先の URL、空白のあとは画像の説明（任意）。管理画面の「画像を挿入」がこの行を入れる。
 * 目印の行でも、サイト用に保存した画像（Vercel Blob の site/ 配下）でなければ、ただの文字として出す。
 */

const IMAGE_LINE = /^\[画像:(\S+?)(?:\s+(.*?))?\]$/;

export type NewsBlock = { type: "text"; text: string } | { type: "image"; url: string; caption: string };

/** サイト用に保存した画像の URL か（src/lib/site-api.ts の isSiteAssetUrl と同じ条件。画面からも使えるようここにも置く） */
export function isNewsImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith("/site/");
  } catch {
    return false;
  }
}

/** 画像を入れる行。説明に「]」や改行が入っていると目印が崩れるので空白にする */
export function newsImageLine(url: string, caption = ""): string {
  // 末尾の空白は残す（説明を入力している途中で、単語の間の空白が消えないように。表示するときに詰める）
  const c = caption.replace(/[\]\r\n]/g, " ");
  return c.trim() ? `[画像:${url} ${c}]` : `[画像:${url}]`;
}

function imageOf(line: string): { url: string; caption: string } | null {
  const m = line.trim().match(IMAGE_LINE);
  if (!m || !isNewsImageUrl(m[1])) return null;
  return { url: m[1], caption: m[2] ?? "" };
}

/** 本文を「文章のかたまり」と「画像」に分ける。画像の前後の空行は詰める */
export function parseNewsBody(body: string): NewsBlock[] {
  const blocks: NewsBlock[] = [];
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").replace(/^\n+|\n+$/g, "");
    if (text.trim()) blocks.push({ type: "text", text });
    buf = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const img = imageOf(line);
    if (img) {
      flush();
      blocks.push({ type: "image", ...img });
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

/** 画像の目印を除いた文章だけ（説明文・抜粋に使う） */
export function newsPlainText(body: string): string {
  return parseNewsBody(body)
    .filter((b): b is Extract<NewsBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** 本文の画像（並び順どおり） */
export function newsImages(body: string): { url: string; caption: string }[] {
  return parseNewsBody(body).filter((b): b is Extract<NewsBlock, { type: "image" }> => b.type === "image");
}

/** index 番目の画像の行を書き換える（null なら行ごと消す）。編集欄の「説明」「外す」で使う */
export function updateNewsImage(body: string, index: number, next: { caption: string } | null): string {
  let n = -1;
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const img = imageOf(line);
    if (img && ++n === index) {
      if (next) out.push(newsImageLine(img.url, next.caption));
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
