"use client";

import { PRIZE_STYLE, winnerPath, withWidth, type SiteVoiceItem, type SiteWinner } from "@/lib/site-public-shared";
import { useSiteModal } from "./modal-provider";

/** 写真の枠。写真が無いときは地域ごとの色違いのプレースホルダーを出す */
function Photo({ src, region, className = "", alt = "" }: { src: string; region: number | null; className?: string; alt?: string }) {
  return (
    <div className={`ph ph-${region ?? 0}${src ? " has-img" : ""}${className ? ` ${className}` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} loading="lazy" /> : null}
      <span className="ph-l">PHOTO</span>
    </div>
  );
}

function Tags({ w }: { w: SiteWinner }) {
  const p = PRIZE_STYLE[w.prize];
  return (
    <div className="card-tags">
      <span className={`badge ${p.cls}`}>{p.label}</span>
      {w.prize === "gp" && <span className="badge b-gp">グランプリ</span>}
    </div>
  );
}

/**
 * 商品カードのクリック。ふつうに押したらポップアップで開き、
 * ⌘/Ctrl＋クリックや中クリックなど「新しいタブで開く」操作のときは、ブラウザに任せて商品ページを開く。
 * 検索エンジンはリンク先（商品ページ）をたどれる。
 */
function onCardClick(e: React.MouseEvent<HTMLAnchorElement>, open: () => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  open();
}

/** 受賞商品の一覧に並ぶカード */
export function WinnerCard({ w }: { w: SiteWinner }) {
  const { openProduct } = useSiteModal();
  return (
    <a className="card" href={winnerPath(w)} aria-haspopup="dialog" onClick={(e) => onCardClick(e, () => openProduct(w))}>
      <Photo src={withWidth(w.photos[0] ?? "", 640)} region={w.region} alt={w.name} />
      <div className="card-b">
        <Tags w={w} />
        <h3>{w.name}</h3>
        <p>{[w.prefecture, `第${w.edition}回`].filter(Boolean).join("｜")}</p>
      </div>
    </a>
  );
}

/** 特別枠のグランプリ（大きいカード） */
export function GrandPrixCard({ w, emblem }: { w: SiteWinner; emblem: string }) {
  const { openProduct } = useSiteModal();
  return (
    <a className="gp-card" href={winnerPath(w)} aria-haspopup="dialog" onClick={(e) => onCardClick(e, () => openProduct(w))}>
      <Photo src={withWidth(w.photos[0] ?? "", 960)} region={w.region} alt={w.name} />
      <div className="gp-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {emblem ? <img className="emblem" src={emblem} alt="グランプリ受賞ロゴ" /> : null}
        <Tags w={w} />
        <h3>{w.name}</h3>
        <p>{[w.company, w.prefecture].filter(Boolean).join("｜")}</p>
      </div>
    </a>
  );
}

/** 特別枠の最高金賞など（小さいカード） */
export function TopCard({ w }: { w: SiteWinner }) {
  const { openProduct } = useSiteModal();
  return (
    <a className="top-card" href={winnerPath(w)} aria-haspopup="dialog" onClick={(e) => onCardClick(e, () => openProduct(w))}>
      <Photo src={withWidth(w.photos[0] ?? "", 480)} region={w.region} alt={w.name} />
      <div className="top-body">
        <span className={`badge ${PRIZE_STYLE[w.prize].cls}`}>{PRIZE_STYLE[w.prize].label}</span>
        <h3>{w.name}</h3>
        <p>{[w.company, w.prefecture].filter(Boolean).join("｜")}</p>
      </div>
    </a>
  );
}

/** ムービーを開くボタン（ダイジェスト・メディア掲載） */
export function MovieButton({
  videoId, title, className, children, ariaLabel,
}: { videoId: string; title: string; className: string; children: React.ReactNode; ariaLabel?: string }) {
  const { openMovie } = useSiteModal();
  return (
    <button className={className} type="button" aria-label={ariaLabel} onClick={() => openMovie(videoId, title)}>
      {children}
    </button>
  );
}

/** 受賞者の声のカード（クリックで全文） */
export function VoiceCard({ v, index }: { v: SiteVoiceItem; index: number }) {
  const { openVoice } = useSiteModal();
  return (
    <article className="voice" role="button" tabIndex={0} aria-haspopup="dialog"
      onClick={() => openVoice(v)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openVoice(v); } }}>
      <div className={`voice-ph ph ph-${index % 6}${v.photos[0] ? " has-img" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.photos[0] ? <img src={withWidth(v.photos[0], 640)} alt={`${v.productName}の受賞者の声`} loading="lazy" /> : <span className="ph-l">PHOTO</span>}
      </div>
      <span className={`badge ${v.cls}`}>{v.tag}</span>
      <blockquote>{v.quote}</blockquote>
      <footer>
        <div>
          <b>{v.productName}</b>
          <small>{[v.company, v.prefecture].filter(Boolean).join("｜")}</small>
        </div>
      </footer>
      <span className="voice-more">全文を読む →</span>
    </article>
  );
}
