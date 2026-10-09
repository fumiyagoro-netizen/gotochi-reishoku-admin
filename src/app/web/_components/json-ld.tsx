/** 構造化データ（Google などが「何のページか」を読み取るための情報）をページに埋め込む */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // </script> を含む文字列で途中終了しないよう、< をエスケープしておく
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** パンくず（トップ › 第2回 受賞商品 › 商品名 など） */
export function breadcrumbLd(items: { name: string; path: string }[], origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${origin}${it.path}`,
    })),
  };
}
