export const metadata = { title: "エントリーを受け付けました" };

/** エントリー送信後の画面。受付番号を控えていただく */
export default async function EntryCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string }>;
}) {
  const { no } = await searchParams;

  return (
    <section className="sec">
      <div className="wrap entry-notice">
        <p className="eyebrow">Thank you</p>
        <h1 className="h2">エントリーを受け付けました</h1>
        {no && (
          <p className="entry-no">
            受付番号<b>{no}</b>
          </p>
        )}
        <p className="lead" style={{ margin: 0 }}>
          ご応募ありがとうございます。エントリー内容について確認事項がある場合は、ご登録いただいたメールアドレス宛にご連絡いたします。
          書類審査の結果も、同じアドレス宛に順次お知らせします。
        </p>
        <div className="cta-btns" style={{ marginTop: 8 }}>
          <a className="btn btn-primary" href="/entry">別の商品をエントリーする</a>
          <a className="btn btn-ghost" href="/web">トップページへ</a>
        </div>
      </div>
    </section>
  );
}
