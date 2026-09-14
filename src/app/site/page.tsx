import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { ChevronRight, ExternalLink } from "@/components/ui/icons";
import { utcToJstDateInputValue } from "@/lib/award-dates";
import { GRAND_PRIX_TITLE } from "@/lib/prize-shared";
import { MAX_HERO_ENTRIES } from "@/lib/site-collections-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "公開状況" };

// 公開状況（サイト管理のトップ）。いま公開サイトに何が出るかを1画面で見せ、各編集画面へ渡す。
// 年度の公開・特別枠の切り替えそのものは「受賞商品の公開」で行う（操作の入口を1つにする）。

const PUBLIC_SITE = "https://gotouchireisyoku.com/";
const days = (to: Date) => Math.ceil((to.getTime() - Date.now()) / 86400000);

export default async function SiteHomePage() {
  const now = new Date();
  const [awards, config, news, judges, voices, partners, media, logs] = await Promise.all([
    prisma.award.findMany({
      orderBy: { year: "desc" },
      select: {
        id: true, year: true, isActive: true, entryEndDate: true,
        siteSettings: true,
        _count: { select: { entries: { where: { prizeLevel: { not: "" } } } } },
      },
    }),
    prisma.siteConfig.findUnique({ where: { id: 1 } }),
    prisma.siteNews.findMany({ where: { isPublished: true }, orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }], take: 3, select: { title: true } }),
    prisma.siteJudge.findMany({ select: { awardId: true, photoUrl: true, isPublished: true } }),
    prisma.siteVoice.count({ where: { isPublished: true } }),
    prisma.sitePartner.count({ where: { isPublished: true } }),
    prisma.siteMedia.count({ where: { isPublished: true } }),
    prisma.auditLog.findMany({
      where: { action: { in: ["site", "site_award", "site_import", "grand_prix"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { createdAt: true, detail: true, userEmail: true },
    }),
  ]);

  const featured = awards.find((a) => a.siteSettings?.isFeatured);
  const featuredUntil = featured?.siteSettings?.featuredUntil ?? null;
  const featuredExpired = !!featuredUntil && featuredUntil < now;
  const recruiting = awards.find((a) => a.isActive) ?? awards[0];
  const archive = awards.filter((a) => a.siteSettings?.winnersPublished && a.id !== featured?.id);
  const publishedNotYet = awards.filter((a) => !a.siteSettings?.winnersPublished && a._count.entries > 0);
  const judgeYear = judges.filter((j) => j.awardId === recruiting?.id);
  const noPhoto = judgeYear.filter((j) => !j.photoUrl).length;
  const bannerLive =
    !!config?.bannerOn && !!config.bannerText &&
    (!config.bannerFrom || config.bannerFrom <= now) && (!config.bannerTo || now <= config.bannerTo);
  const deadline = recruiting?.entryEndDate ?? null;

  const rows: { href?: string; name: string; note: string; state: React.ReactNode }[] = [
    { href: "/site/banner", name: "お知らせバナー", note: config?.bannerText || "未設定", state: bannerLive ? <Badge tone="success" dot>表示中</Badge> : <Badge tone="neutral">非表示</Badge> },
    { name: "ヘッダー", note: "ロゴ・ナビ・エントリーボタン（固定）", state: <Badge tone="neutral">固定</Badge> },
    {
      href: "/site/hero", name: "ヒーロー掲載商品",
      note: featured ? `${featured.year}年度の設定・実績数 ${config?.statsEntries ?? 0}品 / ${config?.statsPrefectures ?? 0}都道府県` : "特別枠の年度がありません",
      state: featured?.siteSettings?.heroMode === "manual"
        ? <Badge tone="info">手動 {(Array.isArray(featured.siteSettings.heroEntryIds) ? featured.siteSettings.heroEntryIds.length : 0)}件</Badge>
        : <Badge tone="neutral">自動（最大{MAX_HERO_ENTRIES}件）</Badge>,
    },
    {
      href: "/site/media", name: "ダイジェストムービー",
      note: featured?.siteSettings?.digestCaption || (recruiting?.siteSettings?.digestVideoId ? "設定済み" : "未設定"),
      state: (featured ?? recruiting)?.siteSettings?.digestVideoId ? <Badge tone="success">設定済み</Badge> : <Badge tone="outline">未設定</Badge>,
    },
    {
      href: "/site/winners", name: "受賞発表の特別枠",
      note: featured ? `${featured.year}年度（${featured._count.entries}品）${featuredUntil ? `・終了日 ${utcToJstDateInputValue(featuredUntil)}` : ""}` : "掲載する年度がありません",
      state: featured ? (featuredExpired ? <Badge tone="warning">期限切れ</Badge> : <Badge tone="success" dot>掲載中</Badge>) : <Badge tone="outline">非表示</Badge>,
    },
    { href: "/site/news", name: "お知らせ", note: news[0]?.title ?? "公開中のお知らせがありません", state: <Badge tone={news.length ? "success" : "outline"}>公開 {news.length}件</Badge> },
    {
      href: "/site/overview", name: "開催概要・募集要項",
      note: recruiting ? `${recruiting.year}年度${deadline ? `・締切まで ${days(deadline)}日` : ""}` : "—",
      state: recruiting?.siteSettings?.overview ? <Badge tone="success">入力済み</Badge> : <Badge tone="outline">未入力</Badge>,
    },
    {
      href: "/site/judges", name: "審査員",
      note: recruiting ? `${recruiting.year}年度・${judgeYear.filter((j) => j.isPublished).length}名${noPhoto ? `（写真なし ${noPhoto}名）` : ""}` : "—",
      state: judgeYear.length ? <Badge tone="success">{judgeYear.length}名</Badge> : <Badge tone="outline">未登録</Badge>,
    },
    { name: "4つの賞", note: "受賞ロゴの階段（固定）", state: <Badge tone="neutral">固定</Badge> },
    {
      href: "/site/winners", name: "過去の受賞商品",
      note: archive.length ? archive.map((a) => `${a.year}年度（${a._count.entries}品）`).join("・") : "公開済みの年度がありません",
      state: <Badge tone={archive.length ? "success" : "outline"}>{archive.length}年度</Badge>,
    },
    { href: "/site/voices", name: "受賞者の声", note: "横スクロールのカード", state: <Badge tone={voices ? "success" : "outline"}>公開 {voices}件</Badge> },
    { href: "/site/media", name: "掲載情報", note: config?.mediaOutlets ? "媒体名の一覧あり" : "媒体名の一覧が未入力", state: <Badge tone={media ? "success" : "outline"}>動画 {media}本</Badge> },
    { href: "/site/partners", name: "パートナー", note: "主催・後援・協力・協賛のロゴ", state: <Badge tone={partners ? "success" : "outline"}>{partners}件</Badge> },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="公開状況"
        description="公開サイトにいま何が出るか。切り替えの操作は各画面から行います。"
        actions={
          <ButtonLink href={PUBLIC_SITE} external icon={<ExternalLink />}>
            現行サイトを開く
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        <Alert tone="info" title="公開サイトはまだ現行の WordPress で運用中です">
          ここで設定した内容は、新しい公開サイトに切り替えた時点で表示されます。切り替えるまで、現行サイトには反映されません。
        </Alert>

        {featuredExpired && (
          <Alert
            tone="warning"
            title={`特別枠の終了日（${utcToJstDateInputValue(featuredUntil)}）を過ぎています`}
            action={<ButtonLink href={`/site/winners?year=${featured?.year}`} size="sm">受賞商品の公開へ</ButtonLink>}
          >
            公開サイトでは特別枠に表示されません。延長する場合は終了日を変えてください。
          </Alert>
        )}
        {publishedNotYet.map((a) => (
          <Alert
            key={a.id}
            tone="warning"
            action={<ButtonLink href={`/site/winners?year=${a.year}`} size="sm">確認する</ButtonLink>}
          >
            {a.year}年度の受賞商品 {a._count.entries}品がまだ公開されていません。
          </Alert>
        ))}

        <Card padding="none" as="section">
          <CardHeader title="年度ごとの表示" description="受賞商品の公開と特別枠の切り替えは「受賞商品の公開」で行います" />
          <Table>
            <thead>
              <tr>
                <Th>年度</Th>
                <Th>受賞商品</Th>
                <Th>受賞商品を公開</Th>
                <Th>特別枠</Th>
                <Th>サイトでの見え方</Th>
                <Th srLabel="操作" />
              </tr>
            </thead>
            <tbody>
              {awards.map((a) => {
                const s = a.siteSettings;
                const isFeatured = !!s?.isFeatured && !featuredExpired;
                return (
                  <Tr key={a.id}>
                    <Td primary nowrap>{a.year}年度{a.isActive && <Badge tone="info" size="sm">受付中</Badge>}</Td>
                    <Td numeric>{a._count.entries}</Td>
                    <Td nowrap>{s?.winnersPublished ? <Badge tone="success">公開</Badge> : <Badge tone="neutral">非公開</Badge>}</Td>
                    <Td nowrap>{s?.isFeatured ? (featuredExpired ? <Badge tone="warning">期限切れ</Badge> : <Badge tone="success" dot>掲載中</Badge>) : <Badge tone="outline">OFF</Badge>}</Td>
                    <Td>
                      {isFeatured
                        ? "トップの特別枠"
                        : s?.winnersPublished
                          ? "過去の受賞商品・年度別ページ"
                          : a.isActive
                            ? "開催概要・エントリー"
                            : "サイトに出ません"}
                    </Td>
                    <Td nowrap className="text-right">
                      <Link href={`/site/winners?year=${a.year}`} className="text-accent hover:underline">
                        受賞商品
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card padding="none" as="section">
            <CardHeader title="トップページの構成" description="上から順。押すと編集画面へ移ります" />
            <ul className="divide-y divide-line">
              {rows.map((r, i) => {
                const body = (
                  <>
                    <span className="w-6 shrink-0 text-caption font-semibold text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{r.name}</span>
                      <span className="block truncate text-caption text-ink-subtle">{r.note}</span>
                    </span>
                    <span className="shrink-0">{r.state}</span>
                  </>
                );
                return (
                  <li key={r.name + i}>
                    {r.href ? (
                      <Link href={r.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/40">
                        {body}
                        <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-3">
                        {body}
                        <span className="size-4 shrink-0" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="space-y-6">
            <Card padding="none" as="section">
              <CardHeader
                title="発表日にやること"
                description={recruiting?.siteSettings?.announceDate ? `${utcToJstDateInputValue(recruiting.siteSettings.announceDate)}（${recruiting.year}年度の受賞発表）` : "開催概要で受賞発表日を入れると日付が出ます"}
              />
              <ol className="divide-y divide-line">
                {[
                  ["エントリー詳細で受賞を確定する（グランプリも付ける）", "/entries"],
                  ["受賞商品の公開で、その年度をまとめて公開にする", "/site/winners"],
                  ["特別枠をその年度に切り替える（前の年度は自動で過去の受賞商品へ）", "/site/winners"],
                  ["トップ掲載商品を確認する", "/site/hero"],
                  ["お知らせ「結果発表」を公開する", "/site/news"],
                ].map(([label, href], i) => (
                  <li key={label} className="flex items-start gap-3 px-5 py-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-caption font-semibold text-accent">{i + 1}</span>
                    <Link href={href} className="text-sm text-ink hover:text-accent hover:underline">
                      {label}
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>

            <Card padding="none" as="section">
              <CardHeader title="最近の変更" description="サイト管理での操作（操作ログより）" />
              <ul className="divide-y divide-line">
                {logs.map((l, i) => (
                  <li key={i} className="px-5 py-2.5">
                    <p className="text-caption text-ink-subtle">
                      {l.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      ・{l.userEmail}
                    </p>
                    <p className="text-sm text-ink">{l.detail}</p>
                  </li>
                ))}
                {logs.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-subtle">まだ変更がありません</li>}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
