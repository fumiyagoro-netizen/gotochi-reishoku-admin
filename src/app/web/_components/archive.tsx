"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRIZE_STYLE, REGIONS, searchScore, searchTokens, type SiteWinner } from "@/lib/site-public-shared";
import { track } from "@/lib/analytics";
import { WinnerCard, WinnerList } from "./cards";

/** 地域タイルの置き方。北海道・東北を右上に、九州を左下に置いた階段状の並び（日本列島の向き） */
const TILES = [
  { r: 0, x: 66, y: 2, w: 34, h: 26 },
  { r: 1, x: 54, y: 31, w: 34, h: 19 },
  { r: 2, x: 64, y: 52, w: 22, h: 19 },
  { r: 3, x: 44, y: 52, w: 18, h: 19 },
  { r: 4, x: 18, y: 52, w: 24, h: 26 },
  { r: 5, x: 0, y: 70, w: 17, h: 26 },
];

const PAGE = 12;

/**
 * 受賞商品の一覧。キーワード・開催回のタブ・地域で絞り込み、12品ずつ増やして見せる。
 * トップの「受賞商品」と、ヘッダーの虫めがねから開く検索ページ（/search）で使う。
 */
export function WinnersArchive({
  winners,
  editions,
  initialQuery = "",
  autoFocus = false,
  syncUrl = false,
}: {
  winners: SiteWinner[];
  editions: { edition: number; range: string }[];
  /** 検索ページで URL の ?q= から始めるときの検索語 */
  initialQuery?: string;
  /** 開いたらすぐ入力できるようにする（検索ページ） */
  autoFocus?: boolean;
  /** 検索語を URL の ?q= に反映する（検索ページ。結果を共有・再読み込みできるように） */
  syncUrl?: boolean;
}) {
  const [edition, setEdition] = useState<number | "all">(editions.length === 1 ? editions[0].edition : "all");
  const [region, setRegion] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [query, setQuery] = useState(initialQuery);
  const tokens = useMemo(() => searchTokens(query), [query]);

  // キーワードに当てはまる商品と、その点数（キーワードが無ければ全部）
  const scored = useMemo(() => {
    const m = new Map<number, number>();
    for (const w of winners) {
      const s = searchScore(w, tokens);
      if (s > 0) m.set(w.id, s);
    }
    return m;
  }, [winners, tokens]);

  const list = useMemo(
    () =>
      winners
        .filter((w) => scored.has(w.id) && (edition === "all" || w.edition === edition) && (region === null || w.region === region))
        .sort(
          (a, b) =>
            (tokens.length ? scored.get(b.id)! - scored.get(a.id)! : 0) ||
            PRIZE_STYLE[a.prize].rank - PRIZE_STYLE[b.prize].rank ||
            a.id - b.id,
        ),
    [winners, scored, tokens, edition, region],
  );

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    for (const w of winners) {
      if (!scored.has(w.id)) continue;
      if (edition !== "all" && w.edition !== edition) continue;
      if (w.region !== null) c[w.region]++;
    }
    return c;
  }, [winners, scored, edition]);

  const pick = (next: number | "all") => { setEdition(next); setRegion(null); setShown(PAGE); };

  // 検索ページでは、検索語を URL に残す（戻る・再読み込み・共有で同じ結果になる）
  useEffect(() => {
    if (!syncUrl) return;
    const q = query.trim();
    const url = q ? `${location.pathname}?q=${encodeURIComponent(q)}` : location.pathname;
    history.replaceState(history.state, "", url);
  }, [query, syncUrl]);

  // 何が探されているかをアクセス解析に送る（打ち終わって少し止まったときに1回）
  const lastSent = useRef("");
  useEffect(() => {
    const q = query.trim();
    if (!q || q === lastSent.current) return;
    const t = setTimeout(() => {
      lastSent.current = q;
      track("search", { search_term: q });
    }, 1200);
    return () => clearTimeout(t);
  }, [query]);

  const searching = tokens.length > 0;

  return (
    <>
      <div className="win-bar">
        {editions.length > 1 && (
          <div className="tabs" role="tablist" aria-label="開催回">
            <button className={`tab${edition === "all" ? " is-on" : ""}`} role="tab" aria-selected={edition === "all"} onClick={() => pick("all")}>
              すべて
            </button>
            {editions.map((e) => (
              <button key={e.edition} className={`tab${edition === e.edition ? " is-on" : ""}`} role="tab" aria-selected={edition === e.edition} onClick={() => pick(e.edition)}>
                第{e.edition}回 {e.range}
              </button>
            ))}
          </div>
        )}
        <form className="win-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
            placeholder="商品名・会社名・都道府県で探す"
            aria-label="受賞商品をキーワードで探す"
            enterKeyHint="search"
            autoFocus={autoFocus}
          />
          {query && (
            <button type="button" className="win-search-x" aria-label="キーワードを消す" onClick={() => { setQuery(""); setShown(PAGE); }}>
              ×
            </button>
          )}
        </form>
      </div>
      <div className="win-grid">
        <aside className="jmap" data-reveal>
          <p className="jmap-t">地域で絞り込む</p>
          <div className="jmap-tiles">
            {TILES.map((t) => (
              <button
                key={t.r}
                className={`jt${region === t.r ? " is-on" : ""}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, width: `${t.w}%`, height: `${t.h}%` }}
                aria-pressed={region === t.r}
                onClick={() => { setRegion(region === t.r ? null : t.r); setShown(PAGE); }}
              >
                <span>{REGIONS[t.r]}</span>
                <small>{counts[t.r]}</small>
              </button>
            ))}
          </div>
          <button className="jmap-reset" hidden={region === null} onClick={() => { setRegion(null); setShown(PAGE); }}>
            すべての地域を表示
          </button>
        </aside>
        <div>
          <p className="win-count" aria-live="polite">
            {searching && <>「{query.trim()}」 </>}
            {region === null ? "全地域" : REGIONS[region]}｜{list.length}品
          </p>
          {list.length === 0 && (
            <p className="win-empty">
              {searching
                ? "当てはまる受賞商品が見つかりませんでした。ことばを短くするか、別のことばでお試しください。"
                : "この条件の受賞商品はありません。"}
            </p>
          )}
          <WinnerList list={list}>
            <div className="cards">
              {list.slice(0, shown).map((w) => <WinnerCard key={w.id} w={w} />)}
            </div>
          </WinnerList>
          <div className="more-wrap">
            <button className="btn btn-ghost" hidden={shown >= list.length} onClick={() => setShown(shown + PAGE)}>
              もっと見る
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
