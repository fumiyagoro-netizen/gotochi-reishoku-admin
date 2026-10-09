import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";
import { PRIZE_STYLE, editionRange, winnerPath, withWidth } from "@/lib/site-public-shared";
import { siteBase } from "@/lib/site-links";
import { excerpt, pageMeta } from "@/lib/site-meta";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { WinnerCard } from "../../../_components/cards";
import { JsonLd, breadcrumbLd } from "../../../_components/json-ld";

export const dynamic = "force-dynamic";

const PRIZE_NAME = { gp: "グランプリ", top: "最高金賞", gold: "金賞", silver: "銀賞", bronze: "銅賞" } as const;

async function find(yearStr: string, idStr: string) {
  const data = await loadSitePublicData();
  const year = Number(yearStr);
  const id = Number(idStr);
  const w = data.winners.find((x) => x.year === year && x.id === id);
  return { data, w };
}

export async function generateMetadata({ params }: { params: Promise<{ year: string; id: string }> }) {
  const { year, id } = await params;
  const { w } = await find(year, id);
  if (!w) return { title: "受賞商品" };
  const prize = PRIZE_NAME[w.prize];
  const who = [w.company, w.prefecture].filter(Boolean).join("・");
  return pageMeta({
    title: `${w.name}（第${w.edition}回 ${prize}）`,
    description: excerpt(
      `${who ? `${who}の` : ""}「${w.name}」。第${w.edition}回 日本全国！ご当地冷凍食品大賞で${prize}を受賞。${w.appeal}`,
      120,
    ),
    path: winnerPath(w),
    image: w.photos[0] ? withWidth(w.photos[0], 1280) : undefined,
  });
}

/** 受賞商品ごとのページ。商品名で検索した人や、受賞企業のサイトからのリンクの行き先 */
export default async function WinnerPage({ params }: { params: Promise<{ year: string; id: string }> }) {
  const { year, id } = await params;
  const { data, w } = await find(year, id);
  if (!w) notFound();
  const base = await siteBase();
  const top = base || "/";
  const yearPath = `${base}/winners/${w.year}`;

  const style = PRIZE_STYLE[w.prize];
  const extraTitles = w.titles.filter((t) => !t.startsWith("グランプリ"));
  const voice = data.voices.find((v) => v.entryId === w.id);
  // 同じ年度・同じ賞のほかの商品（無ければ同じ年度の上位の賞）を4つ
  const sameYear = data.winners.filter((x) => x.year === w.year && x.id !== w.id);
  const related = [
    ...sameYear.filter((x) => x.prize === w.prize),
    ...sameYear.filter((x) => x.prize !== w.prize).sort((a, b) => PRIZE_STYLE[a.prize].rank - PRIZE_STYLE[b.prize].rank),
  ].slice(0, 4);

  return (
    <div className="yp yp-page">
      <JsonLd
        data={breadcrumbLd(
          [
            { name: "トップ", path: "/" },
            { name: `第${w.edition}回 受賞商品一覧`, path: `/winners/${w.year}` },
            { name: w.name, path: winnerPath(w) },
          ],
          PUBLIC_SITE_ORIGIN,
        )}
      />
      <div className="yp-top">
        <div className="wrap">
          <a className="yp-back" href={yearPath}>← 第{w.edition}回の受賞商品一覧</a>
          <p className="yp-title">第{w.edition}回 日本全国！ご当地冷凍食品大賞 {editionRange(w.year)}</p>
        </div>
      </div>

      <div className="wrap">
        <nav className="wp-crumb" aria-label="現在地">
          <a href={top}>トップ</a><span>›</span>
          <a href={yearPath}>第{w.edition}回 受賞商品一覧</a><span>›</span>
          <span>{w.name}</span>
        </nav>

        <div className="wp-main">
          <div className="wp-gallery">
            <div className={`ph ph-${w.region ?? 0}${w.photos[0] ? " has-img" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.photos[0] ? <img src={withWidth(w.photos[0], 1280)} alt={w.name} /> : <span className="ph-l">PHOTO</span>}
            </div>
            {w.photos.length > 1 && (
              <div className="wp-thumbs">
                {w.photos.slice(1).map((src, i) => (
                  <div className="ph has-img" key={src}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={withWidth(src, 640)} alt={`${w.name}（${i + 2}枚目）`} loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wp-info">
            <div className="card-tags">
              <span className={`badge ${style.cls}`}>{style.label}</span>
              {w.prize === "gp" && <span className="badge b-gp">グランプリ</span>}
              <span className="tag">第{w.edition}回 {editionRange(w.year)}</span>
            </div>
            <h1>{w.name}</h1>
            <p className="wp-meta">{[w.company, w.prefecture].filter(Boolean).join("｜")}</p>
            {extraTitles.length > 0 && (
              <div className="card-tags">
                {extraTitles.map((t) => <span className="tag tag-gold" key={t}>{t}</span>)}
              </div>
            )}
            {w.appeal && (
              <section className="wp-appeal">
                <h2>ご当地のこだわり</h2>
                <p>{w.appeal}</p>
              </section>
            )}
            <div className="pm-btns">
              {w.url && (
                <a className="btn btn-primary" href={w.url} target="_blank" rel="noopener noreferrer">公式サイトを見る ↗</a>
              )}
              <a className="btn btn-ghost" href={yearPath}>第{w.edition}回の受賞商品をすべて見る</a>
            </div>
          </div>
        </div>

        {voice && (
          <section className="wp-voice">
            <h2>受賞者の声</h2>
            <blockquote>{voice.quote}</blockquote>
          </section>
        )}

        {related.length > 0 && (
          <section className="wp-related">
            <h2>第{w.edition}回のほかの受賞商品</h2>
            <div className="cards">
              {related.map((x) => <WinnerCard key={x.id} w={x} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
