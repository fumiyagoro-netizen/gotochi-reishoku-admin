import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";
import { PRIZE_STYLE, editionRange } from "@/lib/site-public-shared";
import { WinnerCard } from "../../_components/cards";

export const dynamic = "force-dynamic";

const GROUPS = [
  { key: "gp", label: "グランプリ", emblem: "/site/em_gp.png" },
  { key: "top", label: "最高金賞", emblem: "/site/em_top.png" },
  { key: "gold", label: "金賞", emblem: "/site/em_gold.png" },
  { key: "silver", label: "銀賞", emblem: "/site/em_silver.png" },
  { key: "bronze", label: "銅賞", emblem: "/site/em_bronze.png" },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const edition = Number(year) - 2024;
  return { title: `第${edition}回 受賞商品一覧` };
}

/** 年度ごとの受賞商品一覧。賞ごとにまとめて並べる */
export default async function WinnersYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const y = Number(year);
  const data = await loadSitePublicData();
  const target = data.years.find((t) => t.year === y);
  if (!target) notFound();

  const list = data.winners.filter((w) => w.year === y);

  return (
    <div className="yp yp-page">
      <div className="yp-top">
        <div className="wrap">
          <a className="yp-back" href="/web">← トップに戻る</a>
          <p className="yp-title">第{target.edition}回 日本全国！ご当地冷凍食品大賞 {target.range}　受賞商品一覧</p>
        </div>
      </div>
      <div className="wrap yp-head">
        <p className="eyebrow">Winners {target.range}</p>
        <h1 className="h2">第{target.edition}回 受賞商品一覧</h1>
        <p className="lead">
          グランプリ・最高金賞・金賞・銀賞・銅賞、全{list.length}品。商品をクリックすると詳細が開きます。
        </p>
        <nav className="yp-nav" aria-label="賞で移動">
          {GROUPS.map((g) => {
            const n = list.filter((w) => w.prize === g.key).length;
            return n ? <a href={`#yp-${g.key}`} key={g.key}>{g.label}<small>{n}</small></a> : null;
          })}
        </nav>
      </div>
      <div className="wrap">
        {GROUPS.map((g) => {
          const group = list.filter((w) => w.prize === g.key).sort((a, b) => a.id - b.id);
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
      <div className="wrap article-nav" style={{ paddingBottom: 60 }}>
        <a className="page-back" href="/web">← トップに戻る</a>
        {data.years.filter((t) => t.year !== y).map((t) => (
          <a className="page-back" style={{ marginLeft: 20 }} href={`/web/winners/${t.year}`} key={t.year}>
            第{t.edition}回（{editionRange(t.year)}）の受賞商品 →
          </a>
        ))}
      </div>
    </div>
  );
}
