import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { siteAssetSrc } from "@/lib/site-collections-shared";

/**
 * 公開サイトの各ページの検索・SNS 共有向けの情報（サーバー専用）。
 * URL は公開ドメインからの相対パスで書く（web/layout.tsx の metadataBase で https://gotouchireisyoku.com が付く）。
 */
export const SITE_NAME = "日本全国！ご当地冷凍食品大賞";

/** 管理画面の「バナー・サイト設定」で入れた OGP 画像（ページ固有の画像が無いときに使う） */
export async function defaultOgImage(): Promise<string | undefined> {
  const row = await prisma.siteConfig.findUnique({ where: { id: 1 }, select: { ogImageUrl: true } });
  return row?.ogImageUrl ? siteAssetSrc(row.ogImageUrl) : undefined;
}

/** 長い文を説明文向けに1文〜120字ほどに縮める */
export function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

export function pageMeta({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  /** ページ名（タイトルの後ろにサイト名が付く） */
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}): Metadata {
  const full = `${title}｜${SITE_NAME}`;
  const images = image ? [image] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: full, description, url: path, siteName: SITE_NAME, locale: "ja_JP", type, images },
    twitter: { card: "summary_large_image", title: full, description, images },
  };
}
