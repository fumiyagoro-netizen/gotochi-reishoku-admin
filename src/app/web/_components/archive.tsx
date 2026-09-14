"use client";

import { useMemo, useState } from "react";
import { PRIZE_STYLE, REGIONS, type SiteWinner } from "@/lib/site-public-shared";
import { WinnerCard } from "./cards";

/** 地域タイルの置き方（日本地図を崩した配置。プロトタイプと同じ） */
const TILES = [
  { r: 0, x: 58, y: 0, w: 42, h: 36 },
  { r: 1, x: 52, y: 40, w: 38, h: 22 },
  { r: 2, x: 31, y: 42, w: 19, h: 20 },
  { r: 3, x: 29, y: 64, w: 24, h: 18 },
  { r: 4, x: 0, y: 60, w: 27, h: 22 },
  { r: 5, x: 0, y: 84, w: 24, h: 16 },
];

const PAGE = 12;

/**
 * 過去の受賞商品。開催回のタブと地域で絞り込み、12品ずつ増やして見せる。
 * 特別枠に出している年度は、ここでは重ねて出さない（editions で渡す年度だけ）。
 */
export function WinnersArchive({ winners, editions }: { winners: SiteWinner[]; editions: { edition: number; range: string }[] }) {
  const [edition, setEdition] = useState<number | "all">(editions.length === 1 ? editions[0].edition : "all");
  const [region, setRegion] = useState<number | null>(null);
  const [shown, setShown] = useState(PAGE);

  const list = useMemo(
    () =>
      winners
        .filter((w) => (edition === "all" || w.edition === edition) && (region === null || w.region === region))
        .sort((a, b) => PRIZE_STYLE[a.prize].rank - PRIZE_STYLE[b.prize].rank || a.id - b.id),
    [winners, edition, region],
  );

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    for (const w of winners) {
      if (edition !== "all" && w.edition !== edition) continue;
      if (w.region !== null) c[w.region]++;
    }
    return c;
  }, [winners, edition]);

  const pick = (next: number | "all") => { setEdition(next); setRegion(null); setShown(PAGE); };

  return (
    <>
      <div className="tabs" role="tablist" aria-label="開催回">
        {editions.length > 1 && (
          <button className={`tab${edition === "all" ? " is-on" : ""}`} role="tab" aria-selected={edition === "all"} onClick={() => pick("all")}>
            すべて
          </button>
        )}
        {editions.map((e) => (
          <button key={e.edition} className={`tab${edition === e.edition ? " is-on" : ""}`} role="tab" aria-selected={edition === e.edition} onClick={() => pick(e.edition)}>
            第{e.edition}回 {e.range}
          </button>
        ))}
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
          <p className="win-count">{region === null ? "全地域" : REGIONS[region]}｜{list.length}品</p>
          <div className="cards">
            {list.slice(0, shown).map((w) => <WinnerCard key={w.id} w={w} />)}
          </div>
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
