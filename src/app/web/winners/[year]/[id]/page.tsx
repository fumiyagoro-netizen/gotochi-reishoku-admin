import { notFound } from "next/navigation";
import { loadSitePublicData } from "@/lib/site-public";
import { PRIZE_STYLE, byPrizeThenId, editionRange, shareText, winnerPath, withWidth } from "@/lib/site-public-shared";
import { siteBase } from "@/lib/site-links";
import { excerpt, pageMeta } from "@/lib/site-meta";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-host";
import { WinnerCard, WinnerList } from "../../../_components/cards";
import { SiteFooter, SiteHeader } from "../../../_components/site-chrome";
import { EntryCta } from "../../../_components/entry-cta";
import { ShareButtons } from "../../../_components/share-buttons";
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
  const pageUrl = `${PUBLIC_SITE_ORIGIN}${winnerPath(w)}`;

  // 前後の商品（年度別ページと同じ並び）
  const sameYear = data.winners.filter((x) => x.year === w.year).sort(byPrizeThenId);
  const at = sameYear.findIndex((x) => x.id === w.id);
  const prev = sameYear[(at - 1 + sameYear.length) % sameYear.length];
  const next = sameYear[(at + 1) % sameYear.length];

  // 同じ都道府県の受賞商品（ほかの回も含む）と、同じ回のほかの受賞商品
  const samePref = w.prefecture
    ? data.winners.filter((x) => x.id !== w.id && x.prefecture === w.prefecture).sort((a, b) => b.year - a.year || byPrizeThenId(a, b)).slice(0, 4)
    : [];
  const shown = new Set([w.id, ...samePref.map((x) => x.id)]);
  const related = [
    ...sameYear.filter((x) => !shown.has(x.id) && x.prize === w.prize),
    ...sameYear.filter((x) => !shown.has(x.id) && x.prize !== w.prize),
  ].slice(0, 4);

  return (
    <>
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
      <SiteHeader top={top} />
      <div className="yp yp-page">
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
                <a className="tag" href={yearPath}>第{w.edition}回 {editionRange(w.year)}</a>
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
              <ShareButtons url={pageUrl} text={shareText(w)} itemName={w.name} />
            </div>
          </div>

          {voice && (
            <section className="wp-voice">
              <h2>受賞者の声</h2>
              <blockquote>{voice.quote}</blockquote>
            </section>
          )}

          {sameYear.length > 1 && (
            <nav className="wp-pager" aria-label="前後の受賞商品">
              <a href={winnerPath(prev)} className="wp-pager-prev">
                <small>← 前の商品</small>
                <b>{prev.name}</b>
              </a>
              <a href={winnerPath(next)} className="wp-pager-next">
                <small>次の商品 →</small>
                <b>{next.name}</b>
              </a>
            </nav>
          )}

          {samePref.length > 0 && (
            <section className="wp-related">
              <h2>{w.prefecture}の受賞商品</h2>
              <WinnerList list={samePref}>
                <div className="cards">
                  {samePref.map((x) => <WinnerCard key={x.id} w={x} />)}
                </div>
              </WinnerList>
            </section>
          )}

          {related.length > 0 && (
            <section className="wp-related">
              <h2>第{w.edition}回のほかの受賞商品</h2>
              <WinnerList list={related}>
                <div className="cards">
                  {related.map((x) => <WinnerCard key={x.id} w={x} />)}
                </div>
              </WinnerList>
              <p className="wp-more"><a className="link-more" href={yearPath}>第{w.edition}回の受賞商品をすべて見る</a></p>
            </section>
          )}
        </div>
      </div>
      <EntryCta data={data} top={top} />
      <SiteFooter data={data} top={top} base={base} />
    </>
  );
}
