/**
 * 公開サイト（/web）で画面とサーバーが共有する形と決まりごと。
 *
 * 管理画面のデータ（Entry・SiteXxx）を、公開サイトの見た目に必要な形にそろえるための層。
 * ここに置くのは「どちらでも使う」ものだけで、DB を読むのは src/lib/site-public.ts。
 */

/** 受賞商品の絞り込みに使う地域。並び順がそのまま地図タイルの並び */
export const REGIONS = ["北海道・東北", "関東・甲信越", "中部", "近畿", "中国・四国", "九州"] as const;

const REGION_OF: Record<string, number> = {};
for (const [i, list] of [
  ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "山梨県", "長野県"],
  ["富山県", "石川県", "福井県", "岐阜県", "静岡県", "愛知県"],
  ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  ["鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県"],
  ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"],
].entries()) {
  for (const pref of list) REGION_OF[pref] = i;
}

/** 都道府県名から地域の番号。分からなければ null（地域で絞り込んだとき出てこない） */
export function regionOf(prefecture: string): number | null {
  const p = prefecture.trim();
  if (!p) return null;
  if (REGION_OF[p] !== undefined) return REGION_OF[p];
  // 「秋田」「東京」のように「県・都・府」が落ちている入力を拾う
  const hit = Object.keys(REGION_OF).find((k) => k.startsWith(p) || p.startsWith(k));
  return hit === undefined ? null : REGION_OF[hit];
}

/** 賞の見た目。rank は表示順（グランプリが先頭） */
export const PRIZE_STYLE = {
  gp: { label: "最高金賞", cls: "b-top", rank: 0 },
  top: { label: "最高金賞", cls: "b-top", rank: 1 },
  gold: { label: "金賞", cls: "b-gold", rank: 2 },
  silver: { label: "銀賞", cls: "b-silver", rank: 3 },
  bronze: { label: "銅賞", cls: "b-bronze", rank: 4 },
} as const;

export type PrizeKey = keyof typeof PRIZE_STYLE;

export function prizeKeyOf(prizeLevel: string, grandPrix: boolean): PrizeKey | null {
  if (prizeLevel === "最高金賞") return grandPrix ? "gp" : "top";
  if (prizeLevel === "金賞") return "gold";
  if (prizeLevel === "銀賞") return "silver";
  if (prizeLevel === "銅賞") return "bronze";
  return null;
}

/** 第1回 = 2025年度。年度から「第n回」 */
export function editionOf(year: number): number {
  return year - 2024;
}

/** 第2回 なら "2025–2026"（開催年度は前年8月〜当年1月にまたがる） */
export function editionRange(year: number): string {
  return `${year - 1}–${year}`;
}

/** サイトに出す受賞商品1品 */
export type SiteWinner = {
  id: number;
  name: string;
  company: string;
  prefecture: string;
  /** REGIONS の番号。未入力なら null */
  region: number | null;
  year: number;
  edition: number;
  prize: PrizeKey;
  /** グランプリ・審査員特別賞などの称号（note があれば賞名） */
  titles: string[];
  /** 写真の URL（最大3枚、1枚目がカードの写真） */
  photos: string[];
  /** エントリー時の「ご当地のこだわり」 */
  appeal: string;
  /** エントリー時の参考URL。空ならボタンを出さない */
  url: string;
};

export type SiteVoiceItem = {
  id: number;
  quote: string;
  photos: string[];
  productName: string;
  company: string;
  prefecture: string;
  /** 例: 第2回 グランプリ・最高金賞 */
  tag: string;
  /** グランプリなら金色のバッジにする */
  cls: string;
};

export type SiteNewsItem = {
  id: number;
  title: string;
  body: string;
  category: string;
  date: string;
  isPinned: boolean;
};

/** 会社名の前後に付く法人格。頭文字を取るときに落とす */
const COMPANY_FORMS = [
  "一般社団法人", "公益社団法人", "一般財団法人", "公益財団法人", "特定非営利活動法人", "社会福祉法人",
  "農事組合法人", "有限責任事業組合", "企業組合", "協同組合", "農業協同組合", "漁業協同組合",
  "株式会社", "有限会社", "合同会社", "合資会社", "合名会社", "NPO法人",
  "（株）", "（有）", "(株)", "(有)", "㈱", "㈲",
];

/**
 * 受賞者の声のカードに出す丸い頭文字。
 * 会社名そのままだと「株式会社◯◯」が「株」になってしまうので、法人格を落としてから1文字目を取る。
 * 会社名が無い・落とすと空になる場合は商品名の1文字目。
 */
export function companyInitial(company: string, productName: string): string {
  let name = (company || "").trim();
  for (const form of COMPANY_FORMS) {
    if (name.startsWith(form)) name = name.slice(form.length);
    if (name.endsWith(form)) name = name.slice(0, -form.length);
  }
  name = name.replace(/^[\s　・･,.\-—–]+/, "").trim();
  const source = name || productName.trim();
  return source.slice(0, 1).toUpperCase();
}
