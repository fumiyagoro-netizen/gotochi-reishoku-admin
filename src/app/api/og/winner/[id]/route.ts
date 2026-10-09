import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { loadSitePublicData } from "@/lib/site-public";
import { renderWinnerOg } from "@/lib/og-winner";

/**
 * 受賞商品の共有用画像（og:image）。商品ページの <meta property="og:image"> から呼ばれる。
 * 公開サイトに出ている商品だけ描く（それ以外は 404）。URL に ?v=（内容の版）が付くので長くキャッシュしてよい。
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadSitePublicData();
  const w = data.winners.find((x) => x.id === Number(id));
  if (!w) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const photo = await photoBytes(w.photos[0]);
  const png = Buffer.from(await (await renderWinnerOg({ ...w, photo })).arrayBuffer());
  // PNG のままだと 0.5〜1MB になるので、SNS が読み込みやすい JPEG にする
  const jpeg = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
    },
  });
}

/** 公開サイトの写真 URL（/api/images/<id>）から、元の写真を取ってくる。取れなければ null（写真なしで描く） */
async function photoBytes(src: string | undefined): Promise<Buffer | null> {
  const m = src?.match(/^\/api\/images\/(\d+)/);
  if (!m) return null;
  const image = await prisma.entryImage.findUnique({ where: { id: Number(m[1]) }, select: { imageUrl: true } });
  if (!image) return null;
  const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
  if (image.imageUrl.includes("private.blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
  }
  try {
    const res = await fetch(image.imageUrl, { headers, signal: AbortSignal.timeout(8000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
