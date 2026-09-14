import { loadSitePublicData } from "@/lib/site-public";
import { PRIZE_STYLE, editionRange } from "@/lib/site-public-shared";
import { Banner, SiteNav } from "./_components/chrome";
import { GrandPrixCard, MovieButton, TopCard } from "./_components/cards";
import { WinnersArchive } from "./_components/archive";
import { VoicesRail } from "./_components/voices-rail";
import { FormButton } from "./_components/form-button";

export const dynamic = "force-dynamic";

/** SNS で共有したときの見え方（管理画面のバナー・サイト設定で入れた内容） */
export async function generateMetadata() {
  const { config } = await loadSitePublicData();
  const title = config.ogTitle || "日本全国！ご当地冷凍食品大賞";
  const description =
    config.ogDescription || "全国から集まったご当地冷凍食品を、審査員が一品一品試食して評価するアワードです。";
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, images: config.ogImageUrl ? [config.ogImageUrl] : [] },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}

const NAV_LINKS = [
  { href: "#overview", label: "開催概要" },
  { href: "#judges", label: "審査員" },
  { href: "#winners", label: "受賞商品" },
  { href: "#voices", label: "受賞者の声" },
  { href: "#news", label: "お知らせ" },
];

const EMBLEM = {
  gp: "/site/em_gp.png",
  top: "/site/em_top.png",
  gold: "/site/em_gold.png",
  silver: "/site/em_silver.png",
  bronze: "/site/em_bronze.png",
} as const;

const JST = "Asia/Tokyo";

/** 2026.08.01 の形。null なら空 */
function fmt(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: JST, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .replace(/\//g, ".");
}

/** 8/1 の形（同じ年のあいだの期間表示に使う） */
function fmtShort(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}/${Number(m[3])}` : value;
}

/** 30000 → 3、25000 → 2.5（万円表示） */
function man(amount: number): string {
  return String(Math.round(amount / 1000) / 10);
}

/** JST の今日（0時）を Date で返す */
function todayJst(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: JST, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${parts}T00:00:00+09:00`);
}

function Chevron() {
  return (
    <span className="chev">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </span>
  );
}

export default async function SiteTopPage() {
  const data = await loadSitePublicData();
  const { config, current, featured, overview, winners, hero, judges, voices, news, partners, media, digest, stats, forms } = data;

  const today = todayJst();
  const bannerLive =
    config.bannerOn &&
    !!config.bannerText &&
    (!config.bannerFrom || config.bannerFrom <= today) &&
    (!config.bannerTo || config.bannerTo >= today);

  const entryPeriod = current?.entryStart && current?.entryEnd ? `${fmt(current.entryStart)} – ${fmt(current.entryEnd).slice(5)}` : "";
  const daysLeft = current?.entryEnd ? Math.ceil((current.entryEnd.getTime() - today.getTime()) / 86_400_000) : null;
  const normalFee = overview.fees.find((f) => f.label === "通常" && f.amount != null) ?? overview.fees.find((f) => f.amount != null);
  const usedFees = overview.fees.filter((f) => f.label && f.amount != null && f.from && f.to);

  // 下の一覧には、特別枠に出している年度も含めてすべての年度を出す
  const archiveWinners = winners;
  const archiveEditions = [...new Set(archiveWinners.map((w) => w.year))]
    .sort((a, b) => b - a)
    .map((y) => ({ edition: y - 2024, range: editionRange(y) }));

  const featuredWinners = featured ? winners.filter((w) => w.year === featured.year) : [];
  const featuredCounts = (["gp", "top", "gold", "silver", "bronze"] as const).map((k) => ({
    key: k,
    label: k === "gp" ? "グランプリ" : PRIZE_STYLE[k].label,
    n: featuredWinners.filter((w) => w.prize === k).length,
  }));
  // 特別枠はその年度のグランプリと最高金賞。右側の枠は4つなので最高金賞は4品まで
  const gp = featuredWinners.find((w) => w.prize === "gp");
  const others = featuredWinners.filter((w) => w.prize === "top").slice(0, 4);

  const organizers = ["主催", "後援", "協力", "協賛"]
    .map((kind) => ({ kind, names: partners.filter((p) => p.kind === kind) }))
    .filter((g) => g.names.length > 0);
  // 主催・後援はコンセプトにロゴで出し、下の帯には協力・協賛だけを流す
  const hosts = partners.filter((p) => p.kind === "主催" || p.kind === "後援");
  const supporters = partners.filter((p) => p.kind === "協力" || p.kind === "協賛");

  const marquee = winners
    .slice()
    .sort((a, b) => PRIZE_STYLE[a.prize].rank - PRIZE_STYLE[b.prize].rank)
    .slice(0, 40)
    .map((w) => w.name);

  return (
    <>
      {bannerLive && <Banner tag={config.bannerTag} text={config.bannerText} linkText={config.bannerLinkText} url={config.bannerUrl} />}
      <SiteNav links={NAV_LINKS} entryUrl="/entry" />

      <main>
        {/* ヒーロー */}
        <section className="hero" id="top">
          <canvas className="frost" id="frost" aria-hidden="true" />
          <div className="wrap hero-in">
            <div className="hero-l">
              <p className="eyebrow hero-eyebrow"><span>第{current?.edition ?? ""}回</span>日本全国！ご当地冷凍食品大賞</p>
              <div className="hero-top">
                <div className="hero-year" aria-hidden="true">{current?.year ?? ""}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="hero-seal-wrap"><img className="hero-seal" src={EMBLEM.gp} alt="日本全国！ご当地冷凍食品大賞 受賞ロゴ" /></span>
              </div>
              <h1 className="hero-h">「ご当地食」に光をあてて、<br />「冷凍」で全国に届ける。</h1>
              <p className="hero-lead">
                全国から集まったご当地冷凍食品を、審査員が一品一品試食して評価するアワード。銅賞・銀賞・金賞・最高金賞を選出し、最高金賞の中からグランプリを決定します。
              </p>
              <div className="hero-chips">
                {entryPeriod && <span className="chip"><b>募集期間</b>{entryPeriod}</span>}
                {normalFee?.amount != null && (
                  <span className="chip"><b>エントリー費</b>{man(normalFee.amount)}万円（税抜）<i>書類選考は無料</i></span>
                )}
              </div>
              <div className="hero-cta">
                <a className="btn btn-primary btn-lg magnet" href="/entry" target="_blank" rel="noopener noreferrer">エントリーはこちら</a>
                <a className="btn btn-ghost btn-lg" href="#overview">開催概要を見る</a>
              </div>
              <dl className="stats">
                <div><dt>エントリー累計</dt><dd><span className="num" data-count={stats.entries}>{stats.entries}</span><small>品</small></dd></div>
                <div><dt>参加都道府県</dt><dd><span className="num" data-count={stats.prefectures}>{stats.prefectures}</span><small>/ 47</small></dd></div>
                <div><dt>受賞商品</dt><dd><span className="num" data-count={stats.winners}>{stats.winners}</span><small>品</small></dd></div>
              </dl>
            </div>
            <div className="hero-r" aria-hidden="true">
              {hero.map((h, i) => (
                <div className={`tile t${i + 1}`} key={h.id}>
                  <div className="tile-in">
                    <div className={`ph ph-${i}${h.photo ? " has-img" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.photo ? <img src={h.photo} alt="" /> : null}
                      <span className="ph-l">PHOTO</span>
                    </div>
                    <div className="tile-b">
                      <span className={`badge ${h.grandPrix ? "b-gp" : "b-top"}`}>{h.grandPrix ? "グランプリ" : "最高金賞"}</span>
                      <strong>{h.name}</strong>
                      <small>{[h.prefecture, `第${h.edition}回`].filter(Boolean).join("｜")}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="hero-tate" aria-hidden="true">日本全国のご当地の味を、冷凍で未来の食卓へ。</p>
          </div>
          {marquee.length > 0 && (
            <div className="marquee" aria-hidden="true">
              <div className="marquee-track">
                {[...marquee, ...marquee].map((n, i) => <span className="mq" key={i}>{n}</span>)}
              </div>
            </div>
          )}
        </section>

        {/* ダイジェストムービー */}
        {digest.videoId && (
          <section className="sec movie" id="movie">
            <div className="wrap movie-in">
              <div className="movie-txt" data-reveal>
                <p className="eyebrow">Digest Movie</p>
                <h2 className="h2">会場の熱気を、<br />ダイジェストで。</h2>
                <p className="lead">最終審査会・表彰式の様子と受賞商品を、ダイジェストムービーでご覧いただけます。</p>
                <MovieButton videoId={digest.videoId} title={digest.caption || "ダイジェストムービー"} className="btn btn-light magnet">
                  <span className="play-ic" aria-hidden="true" />ムービーを再生
                </MovieButton>
                <p className="movie-note">YouTube｜日本全国！ご当地冷凍食品大賞 公式</p>
              </div>
              <MovieButton
                videoId={digest.videoId}
                title={digest.caption || "ダイジェストムービー"}
                className="movie-frame"
                ariaLabel="ダイジェストムービーを再生"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${digest.videoId}/maxresdefault.jpg`} alt="" />
                <span className="movie-shade" aria-hidden="true" />
                <span className="play-big" aria-hidden="true"><span className="play-ring" /><span className="play-tri" /></span>
                {digest.caption && (
                  <span className="movie-cap" aria-hidden="true"><b>DIGEST MOVIE</b><small>{digest.caption}</small></span>
                )}
              </MovieButton>
            </div>
          </section>
        )}

        {/* コンセプト */}
        <section className="sec concept" id="concept">
          <div className="wrap grid-2">
            <div data-reveal>
              <p className="eyebrow">Concept</p>
              <h2 className="h2">ご当地の味を、<br />冷凍で未来の食卓へ。</h2>
            </div>
            <div className="concept-body" data-reveal>
              <p>地域で長く愛されてきた味は、冷凍という技術によって全国どこへでも届けられる時代になりました。日本全国！ご当地冷凍食品大賞は、そんなご当地冷凍食品を発掘し、優れた商品に光をあてるためのアワードです。</p>
              <p>大企業でも個人企業でも、規模に関係なく、エントリーされた商品を一品一品公平に試食して評価します。受賞商品はスーパーマーケット・トレードショーでの展示や、テレビ・新聞などのメディア露出を通じて、全国のバイヤーと消費者に届きます。</p>
              {organizers.length > 0 && (
                <dl className="org">
                  {organizers.map((g) => (
                    <div key={g.kind}><dt>{g.kind}</dt><dd>{g.names.map((p) => p.name).join("／")}</dd></div>
                  ))}
                </dl>
              )}
              {hosts.length > 0 && (
                <div className="orgs" data-reveal-group>
                  {hosts.map((p) => (
                    <figure className="org-card" key={p.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.logo ? <img src={p.logo} alt={p.name} /> : <span className="org-name">{p.name}</span>}
                      <figcaption>{p.kind}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 最新回の受賞発表（特別枠） */}
        {featured && gp && (
          <section className="sec latest" id="latest">
            <div className="wrap">
              <div className="latest-head" data-reveal>
                <div>
                  <p className="eyebrow">Result {editionRange(featured.year)}</p>
                  <h2 className="h2">第{featured.edition}回 受賞商品を発表しました</h2>
                  <p className="lead">
                    {featured.announceDate ? `${fmt(featured.announceDate)}の最終審査会・表彰式で、` : ""}
                    最高金賞の中からグランプリが決定しました。ここではグランプリと最高金賞をご紹介し、全受賞商品は一覧ページで公開しています。
                  </p>
                </div>
              </div>
              <div className="latest-grid" data-reveal-group>
                <GrandPrixCard w={gp} emblem={EMBLEM.gp} />
                {others.map((w) => <TopCard key={w.id} w={w} />)}
              </div>
              <div className="latest-more" data-reveal>
                <div className="latest-counts">
                  {featuredCounts.filter((c) => c.n > 0).map((c) => <span key={c.key}>{c.label}<b>{c.n}</b></span>)}
                  <span>計<b>{featured.count}</b>品</span>
                </div>
                <a className="btn btn-light" href={`/web/winners/${featured.year}`}>第{featured.edition}回の受賞商品をすべて見る</a>
              </div>
            </div>
          </section>
        )}

        {/* お知らせ */}
        {news.length > 0 && (
          <section className="sec news" id="news">
            <div className="wrap">
              <div className="sec-head" data-reveal>
                <div><p className="eyebrow">News</p><h2 className="h2">お知らせ</h2></div>
                <a className="link-more" href="/web/news">お知らせ一覧<Chevron /></a>
              </div>
              <ol className="news-list" data-reveal-group>
                {news.slice(0, 3).map((n) => (
                  <li key={n.id}>
                    <a href={`/web/news/${n.id}`}>
                      <div className="nm">
                        <time dateTime={n.date}>{n.date.replace(/-/g, ".")}</time>
                        <span className={`tag${n.category === "結果発表" ? " tag-gold" : ""}`}>{n.category}</span>
                      </div>
                      <span className="nt">{n.title}</span>
                      <Chevron />
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* 開催概要 */}
        {current && (
          <section className="sec overview" id="overview">
            <div className="wrap">
              <div className="sec-head" data-reveal>
                <div><p className="eyebrow">Overview</p><h2 className="h2">開催概要・募集要項</h2></div>
                <p className="lead" style={{ margin: 0, maxWidth: "30em" }}>
                  第{current.edition}回（{current.year - 1}–{current.year}）のエントリー要項です。<b>書類選考は無料</b>。費用がかかるのは、書類審査を通過して試食審査に進む商品だけです。
                </p>
              </div>
              <div className="ov-layout">
                <dl className="spec" data-reveal-group>
                  {overview.name && (
                    <div>
                      <dt>名称</dt>
                      <dd>
                        <b>{overview.name}</b>
                        {organizers.map((g) => (
                          <small key={g.kind}>{g.kind}：{g.names.map((p) => p.name).join("／")}</small>
                        ))}
                      </dd>
                    </div>
                  )}
                  {overview.target && <div><dt>対象商品</dt><dd><b>{overview.target}</b></dd></div>}
                  {overview.eligibility && <div><dt>応募資格</dt><dd>{overview.eligibility}</dd></div>}
                  {entryPeriod && (
                    <div><dt>募集期間</dt><dd><span className="num-l">{entryPeriod}</span><small>書類審査の結果は順次ご連絡します</small></dd></div>
                  )}
                  <div>
                    <dt>審査の流れ</dt>
                    <dd>
                      <div className="steps3"><span><i>1</i>書類審査（無料）</span>→<span><i>2</i>審査員による試食審査</span>→<span><i>3</i>最終審査会でグランプリ決定</span></div>
                      <small>審査員が一品一品を実際に試食して評価します</small>
                    </dd>
                  </div>
                  <div>
                    <dt>賞</dt>
                    <dd><b>銅賞・銀賞・金賞・最高金賞</b>を選出し、最高金賞の中から<b>グランプリ</b>を決定<small>審査員特別賞などの特別賞は、いずれかの賞を獲得した商品の中から選ばれます</small></dd>
                  </div>
                  {overview.announceText && <div><dt>受賞発表</dt><dd><b>{overview.announceText}</b><small>受賞商品は本サイトとプレスリリースで発表します</small></dd></div>}
                  {overview.perks && <div><dt>受賞特典</dt><dd>{overview.perks}</dd></div>}
                  {overview.exhibition && <div><dt>展示</dt><dd>{overview.exhibition}</dd></div>}
                </dl>
                <aside className="fee-card" data-reveal>
                  <h3>エントリー費（税抜）</h3>
                  <p className="fee-note">書類選考は<b>無料</b>です。書類審査を通過した商品にのみ、エントリー時期に応じた費用が発生します。</p>
                  {usedFees.length > 0 && (
                    <ol className="fee-steps">
                      {usedFees.map((f) => {
                        const isNow = today >= new Date(`${f.from}T00:00:00+09:00`) && today <= new Date(`${f.to}T00:00:00+09:00`);
                        return (
                          <li key={f.label} className={isNow ? "is-now" : undefined}>
                            <span className="f-tag">{f.label}</span>
                            <span className="f-when">{fmtShort(f.from)} – {fmtShort(f.to)}</span>
                            <span className="f-amt">{man(f.amount as number)}<small>万円</small></span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {daysLeft !== null && (
                    <div className="fee-count">
                      <span>エントリー締切まで</span>
                      {daysLeft > 0 ? <><b>{daysLeft}</b><span>日</span></> : <b style={{ fontSize: "1.1rem" }}>受付終了</b>}
                    </div>
                  )}
                  <a className="btn btn-primary magnet" href="/entry" target="_blank" rel="noopener noreferrer">エントリーする</a>
                  <FormButton form={forms.briefing} className="btn btn-ghost btn-sm">説明会に参加する</FormButton>
                  {current.leafletUrl && (
                    <a className="btn btn-ghost btn-sm" href={current.leafletUrl} target="_blank" rel="noopener noreferrer">募集要項リーフレット（PDF）</a>
                  )}
                </aside>
              </div>
              <ol className="flow" data-reveal-group>
                <li><b>エントリー（書類選考）</b><p>フォームから商品情報・写真・こだわりを登録。この段階では費用はかかりません。</p><span className="free">無料</span></li>
                <li><b>試食審査</b><p>書類審査を通過した商品を、審査員が実際に試食して評価します。エントリー費はこの段階で発生します。</p></li>
                <li><b>受賞発表・展示</b><p>受賞商品とグランプリを発表し、スーパーマーケット・トレードショーで受賞商品を展示します。</p></li>
              </ol>
              {overview.timeline.length > 0 && (
                <div className="timeline" id="timeline" data-reveal>
                  <div className="tl-track"><div className="tl-line" /></div>
                  <ol className="tl-items">
                    {overview.timeline.map((t, i) => (
                      <li key={i}><time>{t.date}</time><b>{t.title}</b><span>{t.note}</span></li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 審査員 */}
        {judges.length > 0 && (
          <section className="sec judges" id="judges">
            <div className="wrap">
              <div className="sec-head" data-reveal>
                <div><p className="eyebrow">Judges</p><h2 className="h2">審査員</h2></div>
                <p className="lead" style={{ margin: 0, maxWidth: "30em" }}>冷凍食品・流通・食の専門家が、エントリー商品を一品一品試食して評価します。</p>
              </div>
              <ul className="judge-grid" data-reveal-group>
                {judges.map((j, i) => (
                  <li className="judge" key={j.id}>
                    {j.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <div className="ph judge-ph has-img"><img src={j.photo} alt="" loading="lazy" /></div>
                    ) : (
                      <div className={`ph judge-ph ph-init ph-${i % 6}`}>{j.name.slice(0, 1)}</div>
                    )}
                    <span className={`role${j.role ? "" : " is-empty"}`}>{j.role || "－"}</span>
                    <b>{j.name}</b>
                    {j.title && <small>{j.title}</small>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* 賞 */}
        <section className="sec ladder" id="awards">
          <div className="wrap grid-2">
            <div data-reveal>
              <p className="eyebrow">Awards</p>
              <h2 className="h2">4つの賞と、<br />その先のグランプリ。</h2>
              <p className="lead">エントリー商品の中から銅賞・銀賞・金賞・最高金賞を選出し、最高金賞の中からグランプリを決定します。審査員特別賞などの特別賞も、いずれかの賞を獲得した商品の中から選ばれます。</p>
            </div>
            <ol className="steps" data-reveal-group>
              {([["bronze", "銅賞", "BRONZE"], ["silver", "銀賞", "SILVER"], ["gold", "金賞", "GOLD"], ["top", "最高金賞", "TOP GOLD"], ["gp", "グランプリ", "GRAND PRIX"]] as const).map(([k, ja, en]) => (
                <li className={`st st-${k}`} key={k}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="st-emblem" src={EMBLEM[k]} alt={`${ja} 受賞ロゴ`} />
                  <span className="st-n">{ja}</span>
                  <span className="st-e">{en}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 受賞商品アーカイブ */}
        {archiveWinners.length > 0 && (
          <section className="sec winners" id="winners">
            <div className="wrap">
              <div className="sec-head" data-reveal>
                <div>
                  <p className="eyebrow">Archive</p>
                  <h2 className="h2">受賞商品</h2>
                  <p className="lead" style={{ marginTop: 10, maxWidth: "40em" }}>
                    開催回と地域で絞り込めます。商品をクリックすると、写真とご当地のこだわりが開きます。
                  </p>
                </div>
              </div>
              <WinnersArchive winners={archiveWinners} editions={archiveEditions} />
            </div>
          </section>
        )}

        {/* 受賞者の声 */}
        {voices.length > 0 && (
          <section className="sec voices" id="voices">
            <VoicesRail voices={voices} />
          </section>
        )}

        {/* メディア掲載 */}
        {(media.length > 0 || config.mediaOutlets) && (
          <section className="sec media" id="media">
            <div className="wrap">
              <div className="sec-head" data-reveal>
                <div><p className="eyebrow">Media</p><h2 className="h2">主な掲載情報</h2></div>
              </div>
              {media.length > 0 && (
                <div className="videos" data-reveal-group>
                  {media.map((m) => (
                    <MovieButton key={m.id} videoId={m.youtubeId} title={[m.name, m.outlet].filter(Boolean).join("｜")} className="video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <div className="ph has-img"><img src={`https://i.ytimg.com/vi/${m.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" /><span className="play" aria-hidden="true" /></div>
                      <p>{m.name}{m.outlet && <small>{m.outlet}</small>}</p>
                    </MovieButton>
                  ))}
                </div>
              )}
              {config.mediaOutlets && (
                <p className="media-list" data-reveal>この他、{config.mediaOutlets}など多数のメディアに掲載されています。</p>
              )}
            </div>
          </section>
        )}

        {/* パートナー */}
        {supporters.length > 0 && (
          <section className="sec partners" id="partners">
            <div className="wrap sec-head" data-reveal>
              <div><p className="eyebrow">Partners</p><h2 className="h2">協賛・協力パートナー</h2></div>
            </div>
            <div className="logos" aria-label="パートナー一覧">
              <div className="logos-track">
                {[...supporters, ...supporters].map((p, i) => (
                  <span className="logo" key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.logo ? <img src={p.logo} alt="" loading="lazy" /> : <i />}
                    <small>{p.name}</small>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* エントリー */}
        <section className="cta" id="cta">
          <div className="wrap cta-in" data-reveal>
            <p className="eyebrow">Entry {current?.year ?? ""}</p>
            <h2 className="cta-h">あなたのご当地の味を、<br />全国の食卓へ。</h2>
            {entryPeriod && <p className="cta-p">エントリー受付：{entryPeriod}。書類選考は無料です。</p>}
            <div className="cta-btns">
              <a className="btn btn-light btn-lg magnet" href="/entry" target="_blank" rel="noopener noreferrer">
                エントリーはこちら
              </a>
              <FormButton form={forms.briefing} className="btn btn-outline btn-lg">
                説明会に参加する
              </FormButton>
            </div>
            {forms.contact && (
              <p className="cta-sub">
                ご質問は<FormButton form={forms.contact} className="cta-link">お問い合わせフォーム</FormButton>からお気軽にどうぞ。
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a className="brand" href="#top"><img src="/site/logo_blue.png" alt="日本全国！ご当地冷凍食品大賞" /></a>
            {organizers.length > 0 && (
              <p className="foot-org">
                {organizers.map((g) => (
                  <span key={g.kind}>{g.kind}：{g.names.map((p) => p.name).join("／")}</span>
                ))}
              </p>
            )}
          </div>
          <nav className="foot-links" aria-label="フッター">
            <a href="#overview">開催概要</a>
            <a href="#winners">受賞商品</a>
            <a href="/web/news">お知らせ</a>
            <a href="/entry">エントリー</a>
            <FormButton form={forms.contact} className="foot-link-btn">お問い合わせ</FormButton>
            <a href="/web/privacy">プライバシーポリシー</a>
            {config.footerLinks.map((l) => <a key={l.url} href={l.url}>{l.label}</a>)}
          </nav>
        </div>
        <div className="wrap foot-b">
          <small>© {organizers.find((g) => g.kind === "主催")?.names[0]?.name ?? "一般社団法人未来の食卓"}</small>
        </div>
      </footer>
    </>
  );
}
