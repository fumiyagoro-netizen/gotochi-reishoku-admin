import type { SitePublicData } from "@/lib/site-public";
import { SiteNav } from "./chrome";
import { FormButton } from "./form-button";

/**
 * 公開サイト共通のヘッダーとフッター。トップでは同じページ内へ（#overview）、
 * 下層ページ（受賞商品一覧・商品ページ・お知らせ・プライバシー）ではトップの該当箇所へ（/#overview）つなぐ。
 */

const NAV = [
  { anchor: "overview", label: "開催概要" },
  { anchor: "judges", label: "審査員" },
  { anchor: "winners", label: "受賞商品" },
  { anchor: "voices", label: "受賞者の声" },
  { anchor: "news", label: "お知らせ" },
];

/** top は「トップページの URL」（公開ドメインでは "/"）。トップ自身で使うときは "" */
export function SiteHeader({ top }: { top: string }) {
  return (
    <SiteNav
      links={NAV.map((n) => ({ href: `${top}#${n.anchor}`, label: n.label }))}
      entryUrl="/entry"
      homeHref={top ? top : "#top"}
    />
  );
}

export function SiteFooter({ data, top, base }: { data: SitePublicData; top: string; base: string }) {
  const organizers = ["主催", "後援", "協力", "協賛"]
    .map((kind) => ({ kind, names: data.partners.filter((p) => p.kind === kind) }))
    .filter((g) => g.names.length > 0);
  const latestYear = data.years[0]?.year;
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a className="brand" href={top || "#top"}><img src="/brand/logo_blue.png" alt="日本全国！ご当地冷凍食品大賞" /></a>
          {organizers.length > 0 && (
            <p className="foot-org">
              {organizers.map((g) => (
                <span key={g.kind}>{g.kind}：{g.names.map((p) => p.name).join("／")}</span>
              ))}
            </p>
          )}
        </div>
        <nav className="foot-links" aria-label="フッター">
          <a href={`${top}#overview`}>開催概要</a>
          {data.years.map((y) => (
            <a key={y.year} href={`${base}/winners/${y.year}`}>第{y.edition}回 受賞商品</a>
          ))}
          {!latestYear && <a href={`${top}#winners`}>受賞商品</a>}
          <a href={`${base}/news`}>お知らせ</a>
          <a href="/entry">エントリー</a>
          <FormButton form={data.forms.contact} className="foot-link-btn">お問い合わせ</FormButton>
          <a href={`${base}/privacy`}>プライバシーポリシー</a>
          {data.config.footerLinks.map((l) => <a key={l.url} href={l.url}>{l.label}</a>)}
        </nav>
      </div>
      <div className="wrap foot-b">
        <small>© {organizers.find((g) => g.kind === "主催")?.names[0]?.name ?? "一般社団法人未来の食卓"}</small>
      </div>
    </footer>
  );
}
