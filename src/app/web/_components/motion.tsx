"use client";

import { useEffect } from "react";

/**
 * 公開サイトの動き（プロトタイプの見た目をそのまま持ってきたもの）。
 * ヘッダーの状態・ヒーローの霜のキャンバス・スクロールでの出現・数字のカウント・
 * 年表の進み具合・なめらかスクロール・磁石ボタン。
 * どれも見た目だけなので、動きを減らす設定の人や読み込みに失敗したときは静かに止まる。
 */
export function SiteMotion() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const cleanups: (() => void)[] = [];
    let cancelled = false;

    /* ヘッダー（下にスクロールしたら白く） */
    const nav = document.getElementById("nav");
    const onScroll = () => nav?.classList.toggle("is-scrolled", window.pageYOffset > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    /* 今どの節を見ているかをナビに反映 */
    if ("IntersectionObserver" in window) {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".nav-links a"));
      const io = new IntersectionObserver(
        (es) => {
          for (const en of es) {
            if (!en.isIntersecting) continue;
            for (const a of links) a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`);
          }
        },
        { rootMargin: "-40% 0px -55% 0px" },
      );
      for (const id of ["overview", "judges", "winners", "voices", "news", "partners"]) {
        const s = document.getElementById(id);
        if (s) io.observe(s);
      }
      cleanups.push(() => io.disconnect());
    }

    /* ヒーローの霜（ゆっくり漂う光の粒） */
    const cv = document.getElementById("frost") as HTMLCanvasElement | null;
    const hero = document.getElementById("top");
    const ctx = cv?.getContext("2d") ?? null;
    if (cv && ctx && hero) {
      let W = 0, H = 0, mx = 0, my = 0, tx = 0, ty = 0, running = false, rafId = 0;
      let parts: { x: number; y: number; r: number; a: number; vx: number; vy: number; d: number; c: string }[] = [];
      let seededAt = -1;
      const seed = () => {
        parts = [];
        seededAt = W;
        const n = W < 720 ? 18 : 34;
        for (let i = 0; i < n; i++) {
          const blue = Math.random() < 0.35;
          parts.push({
            x: Math.random() * W, y: Math.random() * H, r: 40 + Math.random() * 150,
            a: 0.05 + Math.random() * 0.09, vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.09,
            d: 0.3 + Math.random() * 0.7, c: blue ? "10,79,143" : "25,180,215",
          });
        }
      };
      const resize = () => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const r = (cv.parentElement as HTMLElement).getBoundingClientRect();
        W = r.width; H = r.height;
        cv.width = W * dpr; cv.height = H * dpr;
        cv.style.width = `${W}px`; cv.style.height = `${H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!parts.length || seededAt !== W) seed();
      };
      const draw = () => {
        ctx.clearRect(0, 0, W, H);
        tx += (mx - tx) * 0.04; ty += (my - ty) * 0.04;
        const g = ctx.createRadialGradient(W * 0.74 + tx * 40, H * 0.3 + ty * 40, 0, W * 0.74 + tx * 40, H * 0.3 + ty * 40, Math.max(W, H) * 0.62);
        g.addColorStop(0, "rgba(25,180,215,.32)");
        g.addColorStop(0.45, "rgba(10,79,143,.10)");
        g.addColorStop(1, "rgba(243,247,251,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        for (const p of parts) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -p.r) p.x = W + p.r;
          if (p.x > W + p.r) p.x = -p.r;
          if (p.y < -p.r) p.y = H + p.r;
          if (p.y > H + p.r) p.y = -p.r;
          const px = p.x + tx * 50 * p.d, py = p.y + ty * 50 * p.d;
          const rg = ctx.createRadialGradient(px, py, 0, px, py, p.r);
          rg.addColorStop(0, `rgba(${p.c},${p.a})`);
          rg.addColorStop(1, `rgba(${p.c},0)`);
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(px, py, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      const loop = () => { draw(); if (running) rafId = requestAnimationFrame(loop); };
      const start = () => { if (running || reduce) return; running = true; rafId = requestAnimationFrame(loop); };
      const stop = () => { running = false; cancelAnimationFrame(rafId); };
      resize();
      draw();
      const onResize = () => { resize(); if (reduce) draw(); };
      window.addEventListener("resize", onResize, { passive: true });
      const onMove = (e: PointerEvent) => {
        const r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5;
        my = (e.clientY - r.top) / r.height - 0.5;
      };
      hero.addEventListener("pointermove", onMove);
      const io = new IntersectionObserver((es) => (es[0].isIntersecting ? start() : stop()));
      io.observe(hero);
      cleanups.push(() => {
        stop();
        io.disconnect();
        window.removeEventListener("resize", onResize);
        hero.removeEventListener("pointermove", onMove);
      });
    }

    /* 数字のカウントアップ */
    const countUp = (el: HTMLElement) => {
      const target = Number(el.getAttribute("data-count") ?? "0");
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 1500);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e).toLocaleString("ja-JP");
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    /* 磁石ボタン */
    if (!reduce && fine) {
      for (const b of Array.from(document.querySelectorAll<HTMLElement>(".magnet"))) {
        const move = (e: PointerEvent) => {
          const r = b.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          b.style.transform = `translate(${(x * 0.18).toFixed(1)}px,${(y * 0.22).toFixed(1)}px)`;
        };
        const leave = () => { b.style.transform = ""; };
        b.addEventListener("pointermove", move);
        b.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          b.removeEventListener("pointermove", move);
          b.removeEventListener("pointerleave", leave);
        });
      }
    }

    /* 年表の進み具合（スクロールに追従しないときは最後まで出す） */
    const tlEl = document.getElementById("timeline");
    const tlItems = tlEl ? Array.from(tlEl.querySelectorAll<HTMLElement>(".tl-items li")) : [];
    const setProgress = (p: number) => {
      if (!tlEl) return;
      tlEl.style.setProperty("--p", p.toFixed(3));
      tlItems.forEach((li, i) => li.classList.toggle("is-on", p >= i / Math.max(1, tlItems.length - 1) - 0.02));
    };

    if (reduce) {
      setProgress(1);
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(".num"))) countUp(el);
      return () => { for (const c of cleanups) c(); };
    }

    /* なめらかスクロールと出現アニメ。読み込めなければ、ふつうのスクロールのまま */
    (async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const ticker = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);

      const onAnchor = (e: MouseEvent) => {
        const a = (e.target as HTMLElement)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
        if (!a) return;
        const id = a.getAttribute("href") ?? "";
        e.preventDefault();
        if (id.length < 2) return;
        const el = document.querySelector(id);
        if (!el) return;
        document.getElementById("navMobile")?.setAttribute("hidden", "");
        document.getElementById("burger")?.setAttribute("aria-expanded", "false");
        lenis.scrollTo(el as HTMLElement, { offset: -76, duration: 1.25 });
      };
      document.addEventListener("click", onAnchor);

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-eyebrow", { y: 16, opacity: 0, duration: 0.7 })
        .from(".hero-year", { y: 40, opacity: 0, duration: 1 }, "-=0.5")
        .from(".hero-seal", { scale: 0.5, opacity: 0, rotate: -14, duration: 1.1, ease: "back.out(1.7)" }, "-=0.6")
        .from(".hero-h", { y: 28, opacity: 0, duration: 0.9 }, "-=0.7")
        .from([".hero-lead", ".hero-chips", ".hero-cta", ".stats"], { y: 22, opacity: 0, duration: 0.8, stagger: 0.09 }, "-=0.6")
        .from(".tile", { y: 46, opacity: 0, scale: 0.96, duration: 1.1, stagger: 0.1 }, "-=1")
        .from(".hero-tate", { opacity: 0, duration: 1 }, "-=0.8")
        .from(".marquee", { opacity: 0, duration: 0.8 }, "-=0.9");
      tl.call(() => { for (const el of Array.from(document.querySelectorAll<HTMLElement>(".num"))) countUp(el); }, undefined, 0.6);

      for (const el of gsap.utils.toArray<HTMLElement>("[data-reveal]")) {
        gsap.from(el, { y: 28, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      }
      for (const g of gsap.utils.toArray<HTMLElement>("[data-reveal-group]")) {
        gsap.from(g.children, { y: 26, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, scrollTrigger: { trigger: g, start: "top 86%", once: true } });
      }
      if (tlEl) {
        ScrollTrigger.create({ trigger: tlEl, start: "top 78%", end: "bottom 45%", scrub: 0.6, onUpdate: (s) => setProgress(s.progress) });
      }
      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh);
      document.fonts?.ready.then(refresh);

      cleanups.push(() => {
        document.removeEventListener("click", onAnchor);
        window.removeEventListener("load", refresh);
        gsap.ticker.remove(ticker);
        lenis.destroy();
        for (const t of ScrollTrigger.getAll()) t.kill();
        tl.kill();
      });
    })().catch(() => {
      setProgress(1);
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(".num"))) countUp(el);
    });

    return () => {
      cancelled = true;
      for (const c of cleanups) c();
    };
  }, []);

  return null;
}
