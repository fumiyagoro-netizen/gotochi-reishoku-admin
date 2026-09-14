import { prisma } from "@/lib/prisma";
import { GRAND_PRIX_TITLE } from "@/lib/prize-shared";
import { normalizeOverview, type SiteOverview } from "@/lib/site-overview-shared";
import { normalizeFooterLinks, type FooterLink } from "@/lib/site-config-shared";
import { siteAssetSrc, MAX_HERO_ENTRIES } from "@/lib/site-collections-shared";
import {
  editionOf,
  editionRange,
  prizeKeyOf,
  regionOf,
  type PrizeKey,
  type SiteNewsItem,
  type SiteVoiceItem,
  type SiteWinner,
} from "@/lib/site-public-shared";

/**
 * 公開サイト（/web）が出す中身を、管理画面に入っているデータから組み立てる（サーバー専用）。
 *
 * 公開サイトは管理画面の入力をそのまま映す。ここで「出す・出さない」を最終的に決める：
 * - 受賞商品は、年度が「受賞商品を公開」ON かつ商品が sitePublished のものだけ
 * - お知らせ・審査員・受賞者の声・パートナー・メディアは isPublished のものだけ
 */

export type SiteYear = {
  awardId: number;
  year: number;
  edition: number;
  range: string;
  announceDate: Date | null;
  count: number;
};

export type SiteHeroTile = {
  id: number;
  name: string;
  company: string;
  prefecture: string;
  photo: string;
  prize: PrizeKey;
  edition: number;
  grandPrix: boolean;
};

export type SitePublicData = Awaited<ReturnType<typeof loadSitePublicData>>;

/** 商品写真の URL。サイト用に選んだ写真（sitePhotoIds）が先、無ければメイン→サブの順 */
function photoUrls(
  images: { id: number; imageType: string; sortOrder: number }[],
  sitePhotoIds: unknown,
): string[] {
  const picked = Array.isArray(sitePhotoIds) ? sitePhotoIds.filter((v): v is number => Number.isInteger(v)) : [];
  const ordered = picked.length
    ? picked.filter((id) => images.some((im) => im.id === id))
    : images
        .slice()
        .sort((a, b) => (a.imageType === b.imageType ? a.sortOrder - b.sortOrder : a.imageType === "main" ? -1 : 1))
        .map((im) => im.id);
  return ordered.slice(0, 3).map((id) => `/api/images/${id}`);
}

export async function loadSitePublicData() {
  const [configRow, awards, newsRows, voiceRows, partnerRows, mediaRows] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { id: 1 } }),
    prisma.award.findMany({ include: { siteSettings: true }, orderBy: { year: "desc" } }),
    prisma.siteNews.findMany({ where: { isPublished: true }, orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }] }),
    prisma.siteVoice.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        entry: {
          select: {
            productName: true,
            companyName: true,
            prefecture: true,
            prizeLevel: true,
            awardId: true,
            award: { select: { year: true } },
            titles: { select: { name: true } },
          },
        },
      },
    }),
    prisma.sitePartner.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.siteMedia.findMany({ where: { isPublished: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);

  const footerLinks: FooterLink[] = normalizeFooterLinks(configRow?.footerLinks).links;
  // SiteConfig は1行だけ。まだ保存していなければ空で扱う（日付はそのまま Date で持つ）
  const config = {
    bannerOn: configRow?.bannerOn ?? false,
    bannerTag: configRow?.bannerTag ?? "INFO",
    bannerText: configRow?.bannerText ?? "",
    bannerLinkText: configRow?.bannerLinkText ?? "",
    bannerUrl: configRow?.bannerUrl ?? "",
    bannerFrom: configRow?.bannerFrom ?? null,
    bannerTo: configRow?.bannerTo ?? null,
    ogTitle: configRow?.ogTitle ?? "",
    ogDescription: configRow?.ogDescription ?? "",
    ogImageUrl: siteAssetSrc(configRow?.ogImageUrl ?? ""),
    privacyBody: configRow?.privacyBody ?? "",
    privacyUpdatedAt: configRow?.privacyUpdatedAt ?? null,
    mediaOutlets: configRow?.mediaOutlets ?? "",
    statsEntries: configRow?.statsEntries ?? 0,
    statsPrefectures: configRow?.statsPrefectures ?? 0,
  };

  // 募集中の年度（エントリー・開催概要・審査員はこの年度のもの）
  const current = awards.find((a) => a.isActive) ?? awards[0] ?? null;

  // 受賞商品を公開している年度
  const publishedAwards = awards.filter((a) => a.siteSettings?.winnersPublished);

  // 特別枠（最新の受賞発表）。期限切れは自動で外す
  const now = new Date();
  const featuredAward =
    publishedAwards.find(
      (a) => a.siteSettings?.isFeatured && (!a.siteSettings.featuredUntil || a.siteSettings.featuredUntil >= now),
    ) ?? null;

  const entries = publishedAwards.length
    ? await prisma.entry.findMany({
        where: { awardId: { in: publishedAwards.map((a) => a.id) }, prizeLevel: { not: "" }, sitePublished: true },
        select: {
          id: true,
          productName: true,
          companyName: true,
          prefecture: true,
          prizeLevel: true,
          localAppeal: true,
          referenceUrl: true,
          sitePhotoIds: true,
          award: { select: { id: true, year: true } },
          titles: { select: { name: true, note: true, sortOrder: true } },
          images: { select: { id: true, imageType: true, sortOrder: true } },
        },
        orderBy: { id: "asc" },
      })
    : [];

  const winners: SiteWinner[] = [];
  for (const e of entries) {
    const grandPrix = e.titles.some((t) => t.name === GRAND_PRIX_TITLE);
    const prize = prizeKeyOf(e.prizeLevel, grandPrix);
    if (!prize) continue;
    winners.push({
      id: e.id,
      name: e.productName,
      company: e.companyName,
      prefecture: e.prefecture,
      region: regionOf(e.prefecture),
      year: e.award.year,
      edition: editionOf(e.award.year),
      prize,
      titles: e.titles
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => (t.note ? `${t.name}（${t.note}）` : t.name)),
      photos: photoUrls(e.images, e.sitePhotoIds),
      appeal: e.localAppeal,
      url: e.referenceUrl,
    });
  }

  const years: SiteYear[] = publishedAwards.map((a) => ({
    awardId: a.id,
    year: a.year,
    edition: editionOf(a.year),
    range: editionRange(a.year),
    announceDate: a.siteSettings?.announceDate ?? null,
    count: winners.filter((w) => w.year === a.year).length,
  }));

  // トップに出す商品。特別枠を出している年度の設定にしたがい、特別枠が無いときは
  // 受賞商品を公開している一番新しい年度から出す（サイト管理のトップ掲載商品と同じ選び方）
  const heroAward = featuredAward ?? publishedAwards[0] ?? null;
  const heroSettings = heroAward?.siteSettings ?? null;
  const heroYear = heroAward?.year ?? null;
  const heroSource = winners.filter((w) => w.year === heroYear);
  const manualIds = Array.isArray(heroSettings?.heroEntryIds)
    ? (heroSettings.heroEntryIds as unknown[]).filter((v): v is number => Number.isInteger(v))
    : [];
  const heroWinners =
    heroSettings?.heroMode === "manual" && manualIds.length
      ? manualIds.map((id) => heroSource.find((w) => w.id === id)).filter((w): w is SiteWinner => !!w)
      : heroSource
          .filter((w) => w.prize === "gp" || w.prize === "top")
          .sort((a, b) => (a.prize === "gp" ? -1 : b.prize === "gp" ? 1 : 0) || a.id - b.id);
  const hero: SiteHeroTile[] = heroWinners.slice(0, MAX_HERO_ENTRIES).map((w) => ({
    id: w.id,
    name: w.name,
    company: w.company,
    prefecture: w.prefecture,
    photo: w.photos[0] ?? "",
    prize: w.prize,
    edition: w.edition,
    grandPrix: w.prize === "gp",
  }));

  const judges = current
    ? (
        await prisma.siteJudge.findMany({
          where: { awardId: current.id, isPublished: true },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      ).map((j) => ({ id: j.id, name: j.name, title: j.title, role: j.role, photo: siteAssetSrc(j.photoUrl) }))
    : [];

  const publishedYears = new Set(publishedAwards.map((a) => a.id));
  const voices: SiteVoiceItem[] = voiceRows
    .filter((v) => publishedYears.has(v.entry.awardId) && v.entry.prizeLevel)
    .map((v) => {
      const grandPrix = v.entry.titles.some((t) => t.name === GRAND_PRIX_TITLE);
      const edition = editionOf(v.entry.award.year);
      const photos = Array.isArray(v.photoUrls)
        ? (v.photoUrls as unknown[]).filter((u): u is string => typeof u === "string").map(siteAssetSrc)
        : [];
      return {
        id: v.id,
        quote: v.quote,
        photos,
        productName: v.entry.productName,
        company: v.entry.companyName,
        prefecture: v.entry.prefecture,
        tag: `第${edition}回 ${grandPrix ? `${GRAND_PRIX_TITLE}・` : ""}${v.entry.prizeLevel}`,
        cls: grandPrix ? "b-gp" : v.entry.prizeLevel === "最高金賞" ? "b-top" : "b-gold",
      };
    });

  const news: SiteNewsItem[] = newsRows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    date: (n.publishedAt ?? n.createdAt).toISOString().slice(0, 10),
    isPinned: n.isPinned,
  }));

  const partners = partnerRows.map((p) => ({
    id: p.id,
    kind: p.kind,
    name: p.name,
    logo: siteAssetSrc(p.logoUrl),
    url: p.url,
  }));

  const media = mediaRows.map((m) => ({ id: m.id, name: m.name, outlet: m.outlet, youtubeId: m.youtubeId }));

  const overview: SiteOverview = normalizeOverview(current?.siteSettings?.overview);

  return {
    config: { ...config, footerLinks },
    current: current
      ? {
          awardId: current.id,
          year: current.year,
          edition: editionOf(current.year),
          entryStart: current.entryStartDate,
          entryEnd: current.entryEndDate,
          isActive: current.isActive,
          leafletUrl: siteAssetSrc(current.siteSettings?.leafletUrl ?? ""),
          digestVideoId: current.siteSettings?.digestVideoId ?? "",
          digestCaption: current.siteSettings?.digestCaption ?? "",
        }
      : null,
    featured: featuredAward
      ? {
          year: featuredAward.year,
          edition: editionOf(featuredAward.year),
          range: editionRange(featuredAward.year),
          announceDate: featuredAward.siteSettings?.announceDate ?? null,
          count: winners.filter((w) => w.year === featuredAward.year).length,
        }
      : null,
    // ダイジェストは年度ごとに入れるので、動画が入っている一番手前の年度のものを出す
    digest: (() => {
      const s = [featuredAward, heroAward, current].map((a) => a?.siteSettings).find((x) => x?.digestVideoId);
      return { videoId: s?.digestVideoId ?? "", caption: s?.digestCaption ?? "" };
    })(),
    years,
    winners,
    hero,
    judges,
    voices,
    news,
    partners,
    media,
    overview,
    stats: {
      entries: config.statsEntries,
      prefectures: config.statsPrefectures,
      winners: winners.length,
    },
  };
}
