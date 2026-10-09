export const metadata = { title: "ページが見つかりません" };

/** 公開サイトの 404。旧サイトのURLなどから来た人をトップへ案内する */
export default function SiteNotFound() {
  return (
    <section className="sec">
      <div className="wrap entry-notice">
        <p className="eyebrow">404</p>
        <h1 className="h2">ページが見つかりません</h1>
        <p className="lead" style={{ margin: 0 }}>
          お探しのページは、移動または削除された可能性があります。サイトをリニューアルしましたので、トップページからご覧ください。
        </p>
        <a className="btn btn-primary" href="/">トップページへ</a>
      </div>
    </section>
  );
}
