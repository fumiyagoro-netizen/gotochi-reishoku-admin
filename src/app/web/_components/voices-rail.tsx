"use client";

import { useRef } from "react";
import type { SiteVoiceItem } from "@/lib/site-public-shared";
import { VoiceCard } from "./cards";

/** 受賞者の声を横に並べて、矢印とドラッグで送る */
export function VoicesRail({ voices }: { voices: SiteVoiceItem[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0 });

  const step = (dir: number) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector(".voice");
    const w = card ? card.getBoundingClientRect().width + 18 : 400;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * w, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <>
      <div className="scroller-nav">
        <button aria-label="前へ" onClick={() => step(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <button aria-label="次へ" onClick={() => step(1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div
        className="scroller"
        ref={rail}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { down: true, x: e.clientX, left: e.currentTarget.scrollLeft };
          e.currentTarget.classList.add("drag");
        }}
        onPointerMove={(e) => {
          if (!drag.current.down) return;
          e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
        }}
        onPointerUp={(e) => { drag.current.down = false; e.currentTarget.classList.remove("drag"); }}
        onPointerLeave={(e) => { drag.current.down = false; e.currentTarget.classList.remove("drag"); }}
      >
        {voices.map((v, i) => <VoiceCard key={v.id} v={v} index={i} />)}
      </div>
    </>
  );
}
