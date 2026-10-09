"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

/**
 * 受賞商品のページを共有するボタン。
 * スマホなど端末の共有メニューが使える環境では「共有」を先頭に出し、LINE・X・Facebook・リンクのコピーを並べる。
 * 押されたら Google アナリティクスに share イベントを送る。
 */
export function ShareButtons({ url, text, itemName }: { url: string; text: string; itemName?: string }) {
  const [canNative, setCanNative] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const enc = encodeURIComponent;
  const sent = (method: string) => track("share", { method, item_name: itemName ?? "", content_type: "winner" });

  const native = async () => {
    try {
      await navigator.share({ title: text, text, url });
      sent("native");
    } catch {
      /* 共有をやめたときも例外になるので何もしない */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    sent("copy");
    setTimeout(() => setCopied(false), 2000);
  };

  const links = [
    { key: "line", label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${enc(url)}`, icon: <LineIcon /> },
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`, icon: <XIcon /> },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: <FacebookIcon /> },
  ];

  return (
    <div className="share" aria-label="この商品を共有">
      <span className="share-label">シェア</span>
      {canNative && (
        <button type="button" className="share-btn share-native" onClick={native}>
          <ShareIcon />共有
        </button>
      )}
      {links.map((l) => (
        <a
          key={l.key}
          className={`share-btn share-${l.key}`}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sent(l.key)}
          aria-label={`${l.label}で共有`}
        >
          {l.icon}
          <span>{l.label}</span>
        </a>
      ))}
      <button type="button" className="share-btn share-copy" onClick={copy}>
        <LinkIcon />
        <span>{copied ? "コピーしました" : "リンクをコピー"}</span>
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
    </svg>
  );
}
function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.48 3 2 6.63 2 11.1c0 4 3.55 7.35 8.35 7.99.33.07.77.22.88.5.1.25.07.65.03.9l-.14.85c-.04.25-.2.98.86.54 1.06-.45 5.73-3.37 7.81-5.78C21.28 14.53 22 12.89 22 11.1 22 6.63 17.52 3 12 3zM8.1 13.5H6.2a.5.5 0 0 1-.5-.5V9.2a.5.5 0 0 1 1 0v3.3H8.1a.5.5 0 0 1 0 1zm1.96-.5a.5.5 0 0 1-1 0V9.2a.5.5 0 0 1 1 0V13zm4.6 0a.5.5 0 0 1-.9.3l-1.95-2.65V13a.5.5 0 0 1-1 0V9.2a.5.5 0 0 1 .9-.3l1.95 2.65V9.2a.5.5 0 0 1 1 0V13zm3.06-2.4a.5.5 0 0 1 0 1H16.3v.9h1.42a.5.5 0 0 1 0 1H15.8a.5.5 0 0 1-.5-.5V9.2a.5.5 0 0 1 .5-.5h1.92a.5.5 0 0 1 0 1H16.3v.9h1.42z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  );
}
