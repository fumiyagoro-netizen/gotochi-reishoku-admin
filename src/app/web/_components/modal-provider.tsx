"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { PublicForm } from "@/components/public-form";
import type { FormField } from "@/lib/form-shared";
import { PRIZE_STYLE, companyInitial, editionRange, type SiteVoiceItem, type SiteWinner } from "@/lib/site-public-shared";

/** サイトからモーダルで開くフォーム（お問い合わせ・説明会） */
export type SiteForm = {
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
  requireOptIn: boolean;
  optInLabel: string;
  optInHint: string;
  thankYouMessage: string;
};

/**
 * 商品・受賞者の声・ムービーのモーダル。ページのどこからでも開けるように
 * 公開サイト全体をこれで包み、開く関数を useSiteModal() で配る。
 */

type ModalContent =
  | { kind: "product"; winner: SiteWinner }
  | { kind: "voice"; voice: SiteVoiceItem }
  | { kind: "movie"; videoId: string; title: string }
  | { kind: "form"; form: SiteForm };

type Ctx = {
  openProduct: (winner: SiteWinner) => void;
  openVoice: (voice: SiteVoiceItem) => void;
  openMovie: (videoId: string, title: string) => void;
  openForm: (form: SiteForm) => void;
};

const ModalContext = createContext<Ctx | null>(null);

export function useSiteModal(): Ctx {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useSiteModal must be used inside ModalProvider");
  return ctx;
}

/** 写真スライド。1枚のときは矢印・ドットを出さない */
function Slides({ photos, className }: { photos: string[]; className: string }) {
  const [i, setI] = useState(0);
  const n = photos.length;
  const startX = useRef<number | null>(null);
  const go = useCallback((k: number) => setI((k + n) % n), [n]);

  useEffect(() => {
    if (n < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = setInterval(() => setI((v) => (v + 1) % n), 3500);
    return () => clearInterval(timer);
  }, [n, i]);

  if (n === 0) return <div className={`ss ${className}`}><div className="ss-track"><div className="ss-slide ph ph-0"><span className="ph-l">PHOTO</span></div></div></div>;

  return (
    <div
      className={`ss ${className}`}
      onPointerDown={(e) => { startX.current = e.clientX; }}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="ss-track" style={{ transform: `translateX(${-i * 100}%)` }}>
        {photos.map((src, k) => (
          <div className="ss-slide ph ph-0 has-img" key={k}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" />
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <button className="ss-btn ss-prev" type="button" aria-label="前の写真" onClick={() => go(i - 1)}>‹</button>
          <button className="ss-btn ss-next" type="button" aria-label="次の写真" onClick={() => go(i + 1)}>›</button>
          <div className="ss-dots">
            {photos.map((_, k) => (
              <button key={k} type="button" className={`ss-dot${k === i ? " is-on" : ""}`} aria-label={`写真${k + 1}`} onClick={() => go(k)} />
            ))}
          </div>
          <span className="ss-count"><b>{i + 1}</b>/{n}</span>
        </>
      )}
    </div>
  );
}

/**
 * YouTube の再生枠。字幕は最初からオフにする（見る人が再生中に出すのは自由）。
 * cc_load_policy=0 だけでは見る人の設定によっては出るので、YouTube の操作用スクリプトが
 * 読み込めたときは字幕の機能そのものを外す。読み込めなくても再生はできる。
 */
function MovieFrame({ videoId, title }: { videoId: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    let player: { destroy?: () => void } | null = null;
    const w = window as unknown as {
      YT?: { Player: new (el: HTMLElement, opts: unknown) => { destroy?: () => void } };
      onYouTubeIframeAPIReady?: () => void;
    };

    const init = () => {
      if (cancelled || !ref.current || !w.YT?.Player) return;
      try {
        player = new w.YT.Player(ref.current, {
          events: {
            onReady: (e: { target: { unloadModule?: (m: string) => void } }) => {
              try {
                e.target.unloadModule?.("captions");
                e.target.unloadModule?.("cc");
              } catch {
                /* 字幕を外せなくても再生はできる */
              }
            },
          },
        });
      } catch {
        /* 操作用スクリプトが使えないときは、ふつうの埋め込みのまま */
      }
    };

    if (w.YT?.Player) {
      init();
    } else {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        init();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }

    return () => {
      cancelled = true;
      try {
        player?.destroy?.();
      } catch {
        /* 閉じるときの後始末は失敗しても構わない */
      }
    };
  }, [videoId]);

  return (
    <iframe
      ref={ref}
      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&cc_load_policy=0&enablejsapi=1`}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

function ProductBody({ w }: { w: SiteWinner }) {
  const p = PRIZE_STYLE[w.prize];
  const extraTitles = w.titles.filter((t) => !t.startsWith("グランプリ"));
  return (
    <div className="pm">
      <Slides photos={w.photos} className="pm-ph" />
      <div className="pm-body">
        <div className="card-tags">
          <span className={`badge ${p.cls}`}>{p.label}</span>
          {w.prize === "gp" && <span className="badge b-gp">グランプリ</span>}
          <span className="tag">第{w.edition}回 {editionRange(w.year)}</span>
        </div>
        <h3 className="pm-h">{w.name}</h3>
        <p className="pm-meta">{[w.company, w.prefecture].filter(Boolean).join("｜")}</p>
        {extraTitles.length > 0 && (
          <div className="card-tags">
            {extraTitles.map((t) => <span className="tag tag-gold" key={t}>{t}</span>)}
          </div>
        )}
        {w.appeal && (
          <dl className="pm-dl">
            <div><dt>ご当地のこだわり</dt><dd>{w.appeal}</dd></div>
          </dl>
        )}
        {w.url && (
          <div className="pm-btns">
            <a className="btn btn-primary btn-sm" href={w.url} target="_blank" rel="noopener noreferrer">公式サイトを見る ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}

function VoiceBody({ v }: { v: SiteVoiceItem }) {
  return (
    <div className="vm">
      <Slides photos={v.photos} className="vm-ph" />
      <div className="vm-body">
        <span className={`badge ${v.cls}`}>{v.tag}</span>
        <blockquote>{v.quote}</blockquote>
        <footer>
          <span className="avatar">{companyInitial(v.company, v.productName)}</span>
          <div>
            <b>{v.productName}</b>
            <small>{[v.company, v.prefecture].filter(Boolean).join("｜")}</small>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<ModalContent | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);

  const open = useCallback((c: ModalContent) => {
    lastFocus.current = document.activeElement;
    setContent(c);
  }, []);
  const close = useCallback(() => {
    setContent(null);
    const el = lastFocus.current;
    if (el instanceof HTMLElement) el.focus();
  }, []);

  useEffect(() => {
    if (!content) return;
    document.documentElement.classList.add("is-locked");
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("is-locked");
      document.removeEventListener("keydown", onKey);
    };
  }, [content, close]);

  const ctx: Ctx = {
    openProduct: (winner) => open({ kind: "product", winner }),
    openVoice: (voice) => open({ kind: "voice", voice }),
    openMovie: (videoId, title) => open({ kind: "movie", videoId, title }),
    openForm: (form) => open({ kind: "form", form }),
  };

  return (
    <ModalContext.Provider value={ctx}>
      {children}
      <div className="modal" hidden={!content}>
        <div className="modal-back" onClick={close} />
        <div className="modal-box" role="dialog" aria-modal="true" data-lenis-prevent>
          <button className="modal-x" type="button" aria-label="閉じる" ref={closeRef} onClick={close}>×</button>
          <div>
            {content?.kind === "product" && <ProductBody w={content.winner} />}
            {content?.kind === "voice" && <VoiceBody v={content.voice} />}
            {content?.kind === "form" && (
              <div className="fm">
                <div className="fm-head">
                  <h3>{content.form.title}</h3>
                  {content.form.description && <p>{content.form.description}</p>}
                </div>
                <div className="fm-body">
                  <PublicForm
                    slug={content.form.slug}
                    fields={content.form.fields}
                    requireOptIn={content.form.requireOptIn}
                    optInLabel={content.form.optInLabel}
                    optInHint={content.form.optInHint}
                    thankYouMessage={content.form.thankYouMessage}
                  />
                </div>
              </div>
            )}
            {content?.kind === "movie" && (
              <div className="mm">
                <div className="mm-frame">
                  <MovieFrame videoId={content.videoId} title={content.title} />
                </div>
                <div className="mm-foot">
                  <b>{content.title}</b>
                  <a href={`https://www.youtube.com/watch?v=${content.videoId}`} target="_blank" rel="noopener noreferrer">
                    再生できない場合はYouTubeで開く ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalContext.Provider>
  );
}
