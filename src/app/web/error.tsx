"use client";

/**
 * 公開サイトでページを作れなかったとき（データベースに一時的につながらないなど）の画面。
 * これが無いと Next.js の英語のエラー画面が出る。たいていは少し待てば直るので、もう一度読み込むボタンを出す。
 * エラーの内容は src/instrumentation.ts → 障害の通知メールで事務局に届く。
 */
export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="sec">
      <div className="wrap entry-notice">
        <p className="eyebrow">Error</p>
        <h1 className="h2">ページを表示できませんでした</h1>
        <p className="lead" style={{ margin: 0 }}>
          一時的に混み合っている可能性があります。少し時間をおいて、もう一度お試しください。
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>もう一度読み込む</button>
          <a className="btn btn-ghost" href="/">トップページへ</a>
        </div>
      </div>
    </section>
  );
}
