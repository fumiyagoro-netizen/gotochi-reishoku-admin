"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

/**
 * 読み込めなかった写真を出さない <img>（壊れた画像のアイコンを見せない）。
 * ふだんは写真の枠（色のついた下地）だけを残す。hideBox を付けると枠ごと隠す（商品ページのサムネイルなど）。
 *
 * サーバーで描いた <img> は、画面が動き出す前に読み込みに失敗していることがある（その場合 onError が
 * 届かない）ので、表示したときにも「読み込み済みなのに幅が0」かを確かめる。
 */
export function SafeImg({ hideBox = false, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { hideBox?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  // 失敗した写真の URL（写真が差し替わったら、もう一度出してみる）
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const failed = failedSrc !== undefined && failedSrc === props.src;

  const fail = (img: HTMLImageElement | null) => {
    if (hideBox && img?.parentElement) img.parentElement.hidden = true;
    setFailedSrc(typeof props.src === "string" ? props.src : "");
  };

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) fail(img);
    // src が変わったときだけ確かめ直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.src]);

  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt={alt} {...props} onError={(e) => fail(e.currentTarget)} />;
}
