"use client";

import { useEffect, useState } from "react";

/** 上部のお知らせバナー（閉じたらそのタブのあいだは出さない） */
export function Banner({ tag, text, linkText, url }: { tag: string; text: string; linkText: string; url: string }) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem("gr-banner") === "1") setClosed(true); } catch { /* 読めなくても出すだけ */ }
  }, []);
  if (closed) return null;
  return (
    <div className="banner" id="banner">
      <div className="wrap banner-in">
        <span className="banner-tag">{tag}</span>
        <p>{text}</p>
        {url && linkText ? <a className="banner-link" href={url}>{linkText}</a> : null}
        <button className="banner-x" type="button" aria-label="お知らせを閉じる" onClick={() => {
          setClosed(true);
          try { sessionStorage.setItem("gr-banner", "1"); } catch { /* 保存できなくても閉じる */ }
        }}>×</button>
      </div>
    </div>
  );
}

/** ヘッダー。狭い画面はハンバーガーで開く */
export function SiteNav({ links, entryUrl }: { links: { href: string; label: string }[]; entryUrl: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a className="brand" href="#top"><img src="/site/logo_blue.png" alt="日本全国！ご当地冷凍食品大賞" /></a>
        <nav className="nav-links" aria-label="サイト内">
          {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        <a className="btn btn-primary btn-sm nav-cta" href={entryUrl} target="_blank" rel="noopener noreferrer">エントリー</a>
        <button className="nav-burger" id="burger" aria-label="メニュー" aria-expanded={open} aria-controls="navMobile" onClick={() => setOpen(!open)}>
          <span /><span />
        </button>
      </div>
      <div className="nav-mobile" id="navMobile" hidden={!open}>
        {links.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
        <a href={entryUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>エントリー</a>
      </div>
    </header>
  );
}
