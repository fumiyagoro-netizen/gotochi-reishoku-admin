import sharp from "sharp";

/**
 * 画像処理（sharp）はここから読み込む。SVG の読み込みを止めてから渡す。
 *
 * 2026-10 に sharp が内蔵する SVG 処理（librsvg）に、細工した画像で外からプログラムを動かされうる脆弱性
 * （CVE-2026-96889）が見つかった。このサイトは SVG を縮めたり変換したりする必要がないので、修正版（0.35.5）に
 * 上げたうえで、念のため SVG の読み込みそのものを止めておく（sharp の公式の回避策）。応募者が「JPEG」と
 * 名乗って SVG を送ってきても、ここで読み込みを断る。
 * 止める設定はプロセス全体に効く。src/instrumentation.ts の register() でも同じことをしている。
 */
sharp.block({ operation: ["VipsForeignLoadSvg"] });

export default sharp;
