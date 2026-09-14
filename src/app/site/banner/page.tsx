import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { SiteConfigForm } from "@/components/site/site-config-form";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { emptySiteConfig, type FooterLink, type SiteConfigValues } from "@/lib/site-config-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "バナー・サイト設定" };

export default async function SiteBannerPage() {
  const row = await prisma.siteConfig.findUnique({ where: { id: 1 } });
  const values: SiteConfigValues = row
    ? {
        bannerOn: row.bannerOn,
        bannerTag: row.bannerTag,
        bannerText: row.bannerText,
        bannerLinkText: row.bannerLinkText,
        bannerUrl: row.bannerUrl,
        bannerFrom: utcToJstDateInputValue(row.bannerFrom),
        bannerTo: utcToJstDateInputValue(row.bannerTo),
        ogTitle: row.ogTitle,
        ogDescription: row.ogDescription,
        ogImageUrl: row.ogImageUrl,
        footerLinks: Array.isArray(row.footerLinks) ? (row.footerLinks as unknown as FooterLink[]) : [],
        privacyBody: row.privacyBody,
        privacyUpdatedAt: utcToJstDateInputValue(row.privacyUpdatedAt),
        mediaOutlets: row.mediaOutlets,
        statsEntries: row.statsEntries,
        statsPrefectures: row.statsPrefectures,
      }
    : emptySiteConfig();

  return (
    <PageContainer width="detail">
      <PageHeader
        title="バナー・サイト設定"
        description="上部のお知らせバナーと、サイト全体の設定（SNS共有・フッター・プライバシーポリシー・実績数）。"
      />
      <SiteConfigForm initial={values} today={utcToJstDateInputValue(new Date())} />
    </PageContainer>
  );
}
