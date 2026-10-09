import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";
import { PRIZE_STYLE, editionRange, withWidth } from "@/lib/site-public-shared";
import { WinnerCard, WinnerList } from "../../_components/cards";
import { SiteFooter, SiteHeader } from "../../_components/site-chrome";
import { EntryCta } from "../../_components/entry-cta";
import { JsonLd, breadcrumbLd } from "../../_components/json-ld";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { siteBase } from "@/lib/site-links";
import { defaultOgImage, pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

const GROUPS = [
  { key: "gp", label: "グランプリ", emblem: "/brand/em_gp.png" },
  { key: "top", label: "最高金賞", emblem: "/brand/em_top.png" },
  { key: "gold", label: "金賞", emblem: "/brand/em_gold.png" },
  { key: "silver", label: "銀賞", emblem: "/brand/em_silver.png" },
  { key: "bronze", label: "銅賞", emblem: "/brand/em_bronze.png" },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const y = Number(year);
  const edition = y - 2024;
  const { winners } = await loadSitePublicData();
  const list = winners.filter((w) => w.year === y);
  const gp = list.find((w) => w.prize === "gp");
  return pageMeta({
    title: `第${edition}回 受賞商品一覧`,
    description:
      `第${edition}回 日本全国！ご当地冷凍食品大賞（${y - 1}–${y}）の受賞商品${list.length}品。` +
      (gp ? `グランプリ「${gp.name}」をはじめ、` : "") +
      "最高金賞・金賞・銀賞・銅賞の商品を賞ごとに紹介します。",
    path: `/winners/${y}`,
    image: gp?.photos[0] ? withWidth(gp.photos[0], 1280) : await defaultOgImage(),
  });
}

/** 年度ごとの受賞商品一覧。賞ごとにまとめて並べる */
export default async function WinnersYearPage({ params }: { params: Promise<{ year: string }> }) {
  const base = await siteBase();
  const top = base || "/";
  const { year } = await params;
  const y = Number(year);
  const data = await loadSitePublicData();
  const target = data.years.find((t) => t.year === y);
  if (!target) notFound();

  const list = data.winners.filter((w) => w.year === y);
  // 賞の順（グランプリ→最高金賞→…→銅賞）。ポップアップの「次の商品」もこの順で送る
  const ordered = GROUPS.flatMap((g) => list.filter((w) => w.prize === g.key).sort((a, b) => a.id - b.id));

  return (
    <>
      <JsonLd
        data={breadcrumbLd(
          [
            { name: "トップ", path: "/" },
            { name: `第${target.edition}回 受賞商品一覧`, path: `/winners/${target.year}` },
          ],
          PUBLIC_SITE_ORIGIN,
        )}
      />
      <SiteHeader top={top} />
      <div className="yp yp-page">
        <div className="wrap">
          <nav className="wp-crumb" aria-label="現在地">
            <a href={top}>トップ</a><span>›</span>
            <span>第{target.edition}回 受賞商品一覧</span>
          </nav>
        </div>
        <div className="wrap yp-head">
          <p className="eyebrow">Winners {target.range}</p>
          <h1 className="h2">第{target.edition}回 受賞商品一覧</h1>
          <p className="lead">
            グランプリ・最高金賞・金賞・銀賞・銅賞、全{list.length}品。商品をクリックすると詳細が開きます。
          </p>
          {data.years.length > 1 && (
            <div className="tabs year-tabs" aria-label="開催回">
              {data.years.map((t) => (
                <a key={t.year} className={`tab${t.year === y ? " is-on" : ""}`} href={`${base}/winners/${t.year}`} aria-current={t.year === y ? "page" : undefined}>
                  第{t.edition}回 {editionRange(t.year)}
                </a>
              ))}
            </div>
          )}
          <nav className="yp-nav" aria-label="賞で移動">
            {GROUPS.map((g) => {
              const n = list.filter((w) => w.prize === g.key).length;
              return n ? <a href={`#yp-${g.key}`} key={g.key}>{g.label}<small>{n}</small></a> : null;
            })}
          </nav>
        </div>
        <WinnerList list={ordered}>
          <div className="wrap">
            {GROUPS.map((g) => {
              const group = ordered.filter((w) => w.prize === g.key);
              if (!group.length) return null;
              return (
                <section className="yp-group" id={`yp-${g.key}`} key={g.key}>
                  <div className="yp-gh">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="emblem5" src={g.emblem} alt="" />
                    <h2>{g.label}</h2>
                    <small>{group.length}品</small>
                  </div>
                  <div className="cards">
                    {group.map((w) => <WinnerCard key={w.id} w={w} />)}
                  </div>
                </section>
              );
            })}
          </div>
        </WinnerList>
        <div style={{ height: 40 }} />
      </div>
      <EntryCta data={data} top={top} />
      <SiteFooter data={data} top={top} base={base} />
    </>
  );
}
