import type { SitePublicData } from "@/lib/site-public";

/**
 * 下層ページの最後に置くエントリーへの導線。受付期間中だけ出す。
 * 受賞商品を見に来た人（作り手）に、次回のエントリーを知ってもらうため。
 */
export function EntryCta({ data, top }: { data: SitePublicData; top: string }) {
  const c = data.current;
  const now = new Date();
  const open = !!c && (!c.entryStart || c.entryStart <= now) && (!c.entryEnd || now <= c.entryEnd);
  if (!c || !open) return null;
  const end = c.entryEnd
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric" }).format(c.entryEnd)
    : "";
  return (
    <section className="cta cta-compact">
      <div className="wrap cta-in">
        <p className="eyebrow">Entry {c.year}</p>
        <h2 className="cta-h">あなたのご当地の味も、全国の食卓へ。</h2>
        <p className="cta-p">
          第{c.edition}回のエントリーを受け付けています{end ? `（${end}まで）` : ""}。書類選考は無料です。
        </p>
        <div className="cta-btns">
          <a className="btn btn-light btn-lg" href="/entry" target="_blank" rel="noopener noreferrer">エントリーはこちら</a>
          <a className="btn btn-outline btn-lg" href={`${top}#overview`}>開催概要を見る</a>
        </div>
      </div>
    </section>
  );
}
