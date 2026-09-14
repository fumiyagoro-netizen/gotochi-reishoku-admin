"use client";

import { useMemo, useState } from "react";
import { PRIZE_STYLE, REGIONS, type SiteWinner } from "@/lib/site-public-shared";
import { WinnerCard } from "./cards";

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
