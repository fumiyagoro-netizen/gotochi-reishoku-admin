/** 流通企画（/campaigns）の定数と表示ルール — クライアント・サーバーの両方から使う */

// 企画の状態。申請ページに出すのは open だけ
export const CAMPAIGN_STATUSES = ["draft", "open", "closed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "準備中",
  open: "募集中",
  closed: "締切",
};

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

// 企業の回答（RetailCampaignItem.response）。"" は未回答
export const RESPONSES = ["yes", "no"] as const;
export type RetailResponse = (typeof RESPONSES)[number];

export const RESPONSE_LABELS: Record<RetailResponse | "", string> = {
  "": "未回答",
  yes: "参加希望",
  no: "参加しない",
};

export function isResponse(value: unknown): value is RetailResponse | "" {
  return value === "" || (typeof value === "string" && (RESPONSES as readonly string[]).includes(value));
}

// 事務局の確定（RetailCampaignItem.decision）。"" は未定
export const DECISIONS = ["adopted", "declined"] as const;
export type RetailDecision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<RetailDecision | "", string> = {
  "": "未定",
  adopted: "採用",
  declined: "見送り",
};

export function isDecision(value: unknown): value is RetailDecision | "" {
  return value === "" || (typeof value === "string" && (DECISIONS as readonly string[]).includes(value));
}

// Badge tone="custom" に渡す完全クラス文字列（JIT のため結合しない）
export const RESPONSE_BADGE_CLASS: Record<RetailResponse, string> = {
  yes: "bg-blue-50 text-blue-700 ring-blue-600/20",
  no: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
};

export const DECISION_BADGE_CLASS: Record<RetailDecision, string> = {
  adopted: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  declined: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

/** 申請ページで回答を受け付けるか（募集中かつ締切前） */
export function isAnswerable(campaign: { status: string; deadline: Date | string | null }, now = new Date()): boolean {
  if (campaign.status !== "open") return false;
  if (!campaign.deadline) return true;
  return new Date(campaign.deadline).getTime() >= now.getTime();
}

const JST = "Asia/Tokyo";

/** 2026/11/30 */
export function formatJstDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP", { timeZone: JST });
}

/** 2026/11/30 14:05 */
export function formatJstDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 2026年11月30日（申請ページ・メール用） */
export function formatJstDateLong(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: JST, year: "numeric", month: "long", day: "numeric" }).format(
    new Date(value),
  );
}

/** 対象年度（Json の Award.id 配列）を数値の配列に */
export function parseAwardIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
}

/** メールアドレスの照合用（前後の空白を落として小文字） */
export function normalizeEmail(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// 案内メールの差し込み。{{url}} は担当者ごとの申請ページ
export const INVITE_TAGS = ["name", "company", "products", "campaigns", "url"] as const;
export type InviteTag = (typeof INVITE_TAGS)[number];

export const INVITE_TAG_LABELS: Record<InviteTag, string> = {
  name: "宛名",
  company: "企業名",
  products: "対象の商品",
  campaigns: "募集中の企画",
  url: "申請ページのURL",
};

export const DEFAULT_INVITE_SUBJECT = "【ご当地冷凍食品大賞】受賞商品の流通企画への参加募集のご案内";

export const DEFAULT_INVITE_BODY = `{{company}}
{{name}} 様

いつもお世話になっております。ご当地冷凍食品大賞 事務局です。

このたび、ご当地冷凍食品大賞の受賞商品を小売店・通販サイトでご紹介する流通企画を進めております。
下記の企画への参加をご希望されるかどうか、商品ごとにお知らせください。

■ 募集中の企画
{{campaigns}}

■ 対象の商品
{{products}}

■ ご回答はこちら（{{name}} 様専用のページです）
{{url}}

締切までは、同じページから何度でも回答を変更できます。
ご不明な点は、このメールにご返信ください。`;
