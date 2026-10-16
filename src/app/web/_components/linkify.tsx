import { Fragment } from "react";
import { PUBLIC_SITE_HOST } from "@/lib/site-host";

/**
 * 文章の中の URL をリンクにする（お知らせ本文・プライバシーポリシー）。
 * 日本語の文中に書かれることが多いので、「」（）、。などの全角記号の手前で URL を区切り、
 * 末尾の . , ) などの記号はリンクに含めない。サイトの外へのリンクは新しいタブで開く。
 */
const URL_RE = /https?:\/\/[^\s<>"'「」『』（）【】〔〕、。，．！？]+/g;

export function Linkify({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    // 文末の記号はリンクに含めない（例: 「…をご覧ください https://example.com.」）
    const trail = url.match(/[.,;:!?)\]]+$/);
    if (trail) url = url.slice(0, -trail[0].length);
    const start = m.index ?? 0;
    parts.push(text.slice(last, start));
    let external = true;
    try {
      external = new URL(url).hostname !== PUBLIC_SITE_HOST;
    } catch {
      /* 解釈できない URL も外部として扱う */
    }
    parts.push(
      <a key={start} href={url} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {url}
      </a>,
    );
    last = start + url.length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}
