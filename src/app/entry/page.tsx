import { prisma } from "@/lib/prisma";
import { EntryForm } from "@/components/entry-form";
import { loadSitePublicData } from "@/lib/site-public";
import { siteAssetSrc } from "@/lib/site-collections-shared";
import { FormButton } from "../web/_components/form-button";

export const dynamic = "force-dynamic";

const JST = "Asia/Tokyo";

function fmt(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: JST, year: "numeric", month: "long", day: "numeric" }).format(d);
}
function fmtShort(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}/${Number(m[3])}` : value;
}
function man(amount: number): string {
  return String(Math.round(amount / 1000) / 10);
}
function todayJst(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: JST, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${parts}T00:00:00+09:00`);
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <section className="sec">
      <div className="wrap entry-notice">
        <h1 className="h2">{title}</h1>
        <p className="lead">{message}</p>
        <a className="btn btn-primary" href="/web">トップページへ</a>
      </div>
    </section>
  );
}

export default async function EntryPage() {
  const award = await prisma.award.findFirst({
    where: { isActive: true },
    select: { id: true, year: true, name: true, entryStartDate: true, entryEndDate: true },
  });

  if (!award) {
    return <Notice title="現在エントリーを受け付けておりません" message="次回の募集開始までお待ちください。" />;
  }
  const now = new Date();
  if (award.entryStartDate && now < award.entryStartDate) {
    return <Notice title="エントリー受付はまだ開始されていません" message={`受付開始日：${fmt(award.entryStartDate)}`} />;
  }
  if (award.entryEndDate && now > award.entryEndDate) {
    return <Notice title="エントリー受付は終了しました" message="たくさんのご応募ありがとうございました。" />;
  }

  // 費用・審査の流れ・受賞特典は開催概要（サイト管理）から出す
  const site = await loadSitePublicData();
  const { overview, forms, stats } = site;
  const today = todayJst();
  const daysLeft = award.entryEndDate ? Math.ceil((award.entryEndDate.getTime() - today.getTime()) / 86_400_000) : null;
  const fees = overview.fees.filter((f) => f.label && f.amount != null && f.from && f.to);
  const nowFee = fees.find((f) => today >= new Date(`${f.from}T00:00:00+09:00`) && today <= new Date(`${f.to}T00:00:00+09:00`));
  const leaflet = siteAssetSrc(
    (await prisma.siteAwardSettings.findUnique({ where: { awardId: award.id }, select: { leafletUrl: true } }))?.leafletUrl ?? "",
  );
  const perks = overview.perks
    .split(/[／\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <section className="entry-hero">
        <div className="wrap">
          <p className="eyebrow">Entry {award.year}</p>
          <h1 className="h2">{overview.name || award.name}　エントリー</h1>
          <p className="lead">
            フォームに商品の情報と写真をご登録ください。<b>書類選考は無料</b>です。費用がかかるのは、書類審査を通過して試食審査に進む商品だけです。
          </p>
          <div className="entry-facts">
            {award.entryEndDate && (
              <div>
                <dt>エントリー締切</dt>
                <dd>
                  {fmt(award.entryEndDate)}
                  {daysLeft !== null && daysLeft >= 0 && <small>あと{daysLeft}日</small>}
                </dd>
              </div>
            )}
            {nowFee?.amount != null && (
              <div>
                <dt>いまのエントリー費</dt>
                <dd>
                  {man(nowFee.amount)}万円<small>{nowFee.label}（税抜）</small>
                </dd>
              </div>
            )}
            <div>
              <dt>書類選考</dt>
              <dd>
                無料<small>通過した商品だけ費用が発生</small>
              </dd>
            </div>
          </div>
        </div>
      </section>

      <section className="sec entry-sec">
        <div className="wrap entry-layout">
          <div className="entry-form-card">
            <div className="entry-form-head">
              <h2>エントリーフォーム</h2>
              <p>
                商品写真（1枚以上）と、ご当地のこだわり・味やパッケージの特長をご用意のうえ入力してください。入力の途中で分からない項目があれば、空欄のままお問い合わせください。
              </p>
            </div>
            <EntryForm awardId={award.id} awardYear={award.year} />
          </div>

          <aside className="entry-side">
            {fees.length > 0 && (
              <div className="entry-box">
                <h3>エントリー費（税抜）</h3>
                <ol className="fee-steps">
                  {fees.map((f) => {
                    const isNow = f === nowFee;
                    return (
                      <li key={f.label} className={isNow ? "is-now" : undefined}>
                        <span className="f-tag">{f.label}</span>
                        <span className="f-when">{fmtShort(f.from)} – {fmtShort(f.to)}</span>
                        <span className="f-amt">{man(f.amount as number)}<small>万円</small></span>
                      </li>
                    );
                  })}
                </ol>
                <p className="entry-note">書類審査を通過した商品にのみ、エントリー時期に応じた費用が発生します。</p>
              </div>
            )}

            <div className="entry-box">
              <h3>審査の流れ</h3>
              <ol className="entry-steps">
                <li><b>書類審査</b><span>無料。結果は順次ご連絡します</span></li>
                <li><b>試食審査</b><span>審査員が一品一品試食して評価</span></li>
                <li><b>受賞発表・展示</b><span>{overview.announceText || "受賞商品とグランプリを発表"}</span></li>
              </ol>
            </div>

            {perks.length > 0 && (
              <div className="entry-box">
                <h3>受賞すると</h3>
                <ul className="entry-perks">
                  {perks.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}

            <div className="entry-box entry-box-quiet">
              <p className="entry-stat">
                これまでのエントリー<b>{stats.entries}</b>品・受賞<b>{stats.winners}</b>品
              </p>
              {leaflet && (
                <a className="btn btn-ghost btn-sm" href={leaflet} target="_blank" rel="noopener noreferrer">
                  募集要項リーフレット（PDF）
                </a>
              )}
              <FormButton form={forms.contact} className="btn btn-ghost btn-sm">
                お問い合わせ
              </FormButton>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
