"use client";

import { PRIZE_STYLE, companyInitial, type SiteVoiceItem, type SiteWinner } from "@/lib/site-public-shared";
import { useSiteModal } from "./modal-provider";

/** 写真の枠。写真が無いときは地域ごとの色違いのプレースホルダーを出す */
function Photo({ src, region, className = "" }: { src: string; region: number | null; className?: string }) {
  return (
    <div className={`ph ph-${region ?? 0}${src ? " has-img" : ""}${className ? ` ${className}` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" loading="lazy" /> : null}
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

/** 受賞商品の一覧に並ぶカード */
export function WinnerCard({ w }: { w: SiteWinner }) {
  const { openProduct } = useSiteModal();
  return (
    <article className="card" role="button" tabIndex={0} aria-haspopup="dialog"
      onClick={() => openProduct(w)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(w); } }}>
      <Photo src={w.photos[0] ?? ""} region={w.region} />
      <div className="card-b">
        <Tags w={w} />
        <h3>{w.name}</h3>
        <p>{[w.prefecture, `第${w.edition}回`].filter(Boolean).join("｜")}</p>
      </div>
    </article>
  );
}

/** 特別枠のグランプリ（大きいカード） */
export function GrandPrixCard({ w, emblem }: { w: SiteWinner; emblem: string }) {
  const { openProduct } = useSiteModal();
  return (
    <article className="gp-card" role="button" tabIndex={0} aria-haspopup="dialog"
      onClick={() => openProduct(w)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(w); } }}>
      <Photo src={w.photos[0] ?? ""} region={w.region} />
      <div className="gp-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {emblem ? <img className="emblem" src={emblem} alt="グランプリ受賞ロゴ" /> : null}
        <Tags w={w} />
        <h3>{w.name}</h3>
        <p>{[w.company, w.prefecture].filter(Boolean).join("｜")}</p>
      </div>
    </article>
  );
}

/** 特別枠の最高金賞など（小さいカード） */
export function TopCard({ w }: { w: SiteWinner }) {
  const { openProduct } = useSiteModal();
  return (
    <article className="top-card" role="button" tabIndex={0} aria-haspopup="dialog"
      onClick={() => openProduct(w)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProduct(w); } }}>
      <Photo src={w.photos[0] ?? ""} region={w.region} />
      <div className="top-body">
        <span className={`badge ${PRIZE_STYLE[w.prize].cls}`}>{PRIZE_STYLE[w.prize].label}</span>
        <h3>{w.name}</h3>
        <p>{[w.company, w.prefecture].filter(Boolean).join("｜")}</p>
      </div>
    </article>
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
        {v.photos[0] ? <img src={v.photos[0]} alt="" loading="lazy" /> : <span className="ph-l">PHOTO</span>}
      </div>
      <span className={`badge ${v.cls}`}>{v.tag}</span>
      <blockquote>{v.quote}</blockquote>
      <footer>
        <span className="avatar">{companyInitial(v.company, v.productName)}</span>
        <div>
          <b>{v.productName}</b>
          <small>{[v.company, v.prefecture].filter(Boolean).join("｜")}</small>
        </div>
      </footer>
      <span className="voice-more">全文を読む →</span>
    </article>
  );
}
