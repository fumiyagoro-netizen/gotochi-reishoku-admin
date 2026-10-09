import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PRIZE_NAME, type PrizeKey } from "@/lib/site-public-shared";

/**
 * 受賞商品を SNS で共有したときに出る画像（1200×630）をつくる（サーバー専用）。
 * 左に商品写真、右に受賞ロゴ・商品名・会社名。受賞ロゴは写真と右の白地にまたがるように置く。
 *
 * 文字は公開サイトの見出しと同じ Zen Kaku Gothic New を、使う文字だけ Google Fonts から取る。
 * 取れなかったときは同梱の Noto Sans JP（請求書 PDF と共用）で描く。
 */

export const OG_SIZE = { width: 1200, height: 630 };

const PHOTO_W = 600;

const EMBLEM_FILE: Record<PrizeKey, string> = {
  gp: "em_gp.png",
  top: "em_top.png",
  gold: "em_gold.png",
  silver: "em_silver.png",
  bronze: "em_bronze.png",
};

const INK = "#0B2545";
const MUTE = "#5B6B7F";
const BLUE = "#0A4F8F";
const CYAN = "#19B4D7";

export type OgWinner = {
  name: string;
  company: string;
  prefecture: string;
  edition: number;
  prize: PrizeKey;
  /** 商品写真（元の画像のバイト列）。無ければ地色だけ */
  photo: Buffer | null;
};

async function dataUri(buf: Buffer, type: string): Promise<string> {
  return `data:${type};base64,${buf.toString("base64")}`;
}

/** 使う文字だけのフォントを Google Fonts から取る（失敗したら null） */
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(4000) })).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1], { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function loadFonts(text: string) {
  const [bold, medium] = await Promise.all([
    googleFont("Zen Kaku Gothic New", 900, text),
    googleFont("Zen Kaku Gothic New", 700, text),
  ]);
  if (bold && medium) {
    return [
      { name: "Zen", data: bold, weight: 900 as const, style: "normal" as const },
      { name: "Zen", data: medium, weight: 700 as const, style: "normal" as const },
    ];
  }
  const noto = await readFile(path.join(process.cwd(), "assets", "fonts", "NotoSansJP-Regular.ttf"));
  return [{ name: "Zen", data: noto, weight: 400 as const, style: "normal" as const }];
}

/** 商品名の長さで文字の大きさを決める（右の枠に3行までで収まるように） */
function nameSize(name: string): number {
  const n = [...name].length;
  if (n <= 9) return 60;
  if (n <= 16) return 52;
  if (n <= 24) return 44;
  if (n <= 36) return 38;
  return 32;
}

export async function renderWinnerOg(w: OgWinner, headers?: Record<string, string>): Promise<ImageResponse> {
  const prizeLine = `第${w.edition}回 ${w.prize === "gp" ? "グランプリ・最高金賞" : PRIZE_NAME[w.prize]}`;
  const who = [w.company, w.prefecture].filter(Boolean).join("｜");
  const brand = "日本全国！ご当地冷凍食品大賞";
  const domain = "gotouchireisyoku.com";

  const [photo, emblem, fonts] = await Promise.all([
    w.photo
      ? sharp(w.photo)
          .rotate()
          .resize(PHOTO_W, OG_SIZE.height, { fit: "cover", position: "attention" })
          .jpeg({ quality: 84 })
          .toBuffer()
          .then((b) => dataUri(b, "image/jpeg"))
          .catch(() => null)
      : Promise.resolve(null),
    readFile(path.join(process.cwd(), "public", "brand", EMBLEM_FILE[w.prize])).then((b) => dataUri(b, "image/png")),
    loadFonts(`${prizeLine}${w.name}${who}${brand}${domain}`),
  ]);

  const size = nameSize(w.name);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFFFF", fontFamily: "Zen", position: "relative" }}>
        {/* 左：商品写真（無いときは地色） */}
        <div
          style={{
            width: PHOTO_W,
            height: OG_SIZE.height,
            display: "flex",
            background: "linear-gradient(135deg, #E7F1F9 0%, #BFE9F4 100%)",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={PHOTO_W} height={OG_SIZE.height} alt="" style={{ objectFit: "cover" }} />
          ) : null}
        </div>

        {/* 右：受賞の内容 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "268px 56px 44px 56px",
            background: "linear-gradient(180deg, #FFFFFF 0%, #F3F7FB 100%)",
          }}
        >
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: BLUE, letterSpacing: 1 }}>{prizeLine}</div>
          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: size,
              fontWeight: 900,
              color: INK,
              lineHeight: 1.28,
              letterSpacing: 0.5,
            }}
          >
            {w.name}
          </div>
          {who ? (
            <div style={{ display: "flex", marginTop: 16, fontSize: 24, fontWeight: 700, color: MUTE }}>{who}</div>
          ) : null}
          <div style={{ flex: 1, display: "flex" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `3px solid ${CYAN}`,
              paddingTop: 16,
              fontSize: 20,
              fontWeight: 700,
              color: MUTE,
            }}
          >
            <span>{brand}</span>
            <span style={{ color: BLUE }}>{domain}</span>
          </div>
        </div>

        {/* 受賞ロゴ。写真と白地の境目にまたがるように置く */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={emblem}
          width={280}
          height={252}
          alt=""
          style={{ position: "absolute", left: PHOTO_W - 112, top: 22 }}
        />
      </div>
    ),
    { ...OG_SIZE, fonts, headers },
  );
}
