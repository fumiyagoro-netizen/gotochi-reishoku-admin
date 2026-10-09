import { createSign } from "node:crypto";

/**
 * Google アナリティクス（GA4）の数字を読む（サーバー専用）。サイト管理の「アクセス状況」で使う。
 *
 * 公開サイトに入れている Google タグ（src/lib/analytics.ts の GT-KDTJMJB9）が送った記録を、
 * Google Analytics Data API で読み出す。読むのに必要な環境変数（Vercel に登録する）:
 * - GA_PROPERTY_ID          … GA4 の「プロパティ ID」（数字だけ）
 * - GA_SERVICE_ACCOUNT_JSON … Google Cloud のサービスアカウントの鍵（JSON をそのまま、または base64）
 * サービスアカウントには、GA4 の「プロパティのアクセス管理」で「閲覧者」の権限を付けておく。
 * 追加のライブラリは使わず、鍵で署名した JWT からアクセストークンを取って REST API を呼ぶ。
 */

type Credentials = { client_email: string; private_key: string };

export type GaConfig = { propertyId: string; credentials: Credentials };

/** 環境変数がそろっていれば設定を返す。足りなければ null（画面には「未接続」と手順を出す） */
export function gaConfig(): GaConfig | null {
  const propertyId = (process.env.GA_PROPERTY_ID ?? "").replace(/^properties\//, "").trim();
  const raw = (process.env.GA_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!propertyId || !raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(text) as Partial<Credentials>;
    if (!j.client_email || !j.private_key) return null;
    return { propertyId, credentials: { client_email: j.client_email, private_key: j.private_key } };
  } catch {
    return null;
  }
}

/** 設定画面の案内に出す、サービスアカウントのメールアドレス（鍵が読めたときだけ） */
export function gaServiceAccountEmail(): string {
  const raw = (process.env.GA_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (!raw) return "";
  try {
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    return (JSON.parse(text) as { client_email?: string }).client_email ?? "";
  } catch {
    return "";
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(c: Credentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: c.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(c.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "";
    throw new GaError("auth", `Google へのログインに失敗しました（${res.status}${detail ? ` ${detail}` : ""}）`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export class GaError extends Error {
  constructor(
    /** auth = 鍵が違う / permission = GA4 に権限が無い / api = それ以外 */
    public kind: "auth" | "permission" | "api",
    message: string,
  ) {
    super(message);
  }
}

type ReportRequest = Record<string, unknown>;
type ReportRow = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type ReportResponse = { rows?: ReportRow[] };

async function batchRunReports(cfg: GaConfig, requests: ReportRequest[]): Promise<ReportResponse[]> {
  const token = await accessToken(cfg.credentials);
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${cfg.propertyId}:batchRunReports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 403) throw new GaError("permission", "このサービスアカウントに GA4 プロパティの閲覧権限がありません");
  if (!res.ok) throw new GaError("api", `アナリティクスから読み込めませんでした（${res.status}）`);
  return ((await res.json()) as { reports?: ReportResponse[] }).reports ?? [];
}

/** サイトで送っているイベント（src/lib/analytics.ts の track の呼び出し）と、画面に出す名前 */
export const SITE_EVENTS: Record<string, string> = {
  view_winner: "商品の詳しい情報を開いた",
  share: "商品を共有した",
  search: "サイト内で検索した",
  click_entry: "エントリーへ進んだ",
  open_form: "お問い合わせ・説明会のフォームを開いた",
  play_movie: "動画を再生した",
  open_leaflet: "リーフレットを開いた",
  view_voice: "受賞者の声を開いた",
};

export type GaReport = {
  days: number;
  /** 今の期間と、その前の同じ長さの期間 */
  totals: { users: number; views: number; sessions: number };
  previous: { users: number; views: number; sessions: number };
  daily: { date: string; users: number; views: number }[];
  pages: { path: string; title: string; views: number }[];
  channels: { name: string; sessions: number }[];
  sources: { name: string; sessions: number }[];
  devices: { name: string; users: number }[];
  events: { name: string; count: number }[];
  searchTerms: { term: string; count: number }[];
  winnerPages: { path: string; views: number }[];
};

const num = (v: string | undefined) => Number(v ?? 0) || 0;
const dims = (r: ReportRow, i: number) => r.dimensionValues?.[i]?.value ?? "";
const mets = (r: ReportRow, i: number) => num(r.metricValues?.[i]?.value);

const cache = new Map<number, { at: number; report: GaReport }>();
const CACHE_MS = 15 * 60 * 1000;

/** 直近 days 日（今日を含む）の数字。同じ期間は15分のあいだ読み直さない */
export async function loadGaReport(cfg: GaConfig, days: number): Promise<GaReport> {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.report;

  const current = { startDate: `${days - 1}daysAgo`, endDate: "today" };
  const previous = { startDate: `${days * 2 - 1}daysAgo`, endDate: `${days}daysAgo` };
  const top = (metric: string) => [{ metric: { metricName: metric }, desc: true }];

  const [first, second] = await Promise.all([
    batchRunReports(cfg, [
      {
        dateRanges: [current],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }],
      },
      {
        dateRanges: [previous],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }],
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: top("screenPageViews"),
        limit: 10,
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
        orderBys: top("sessions"),
      },
    ]),
    batchRunReports(cfg, [
      {
        dateRanges: [current],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: top("sessions"),
        limit: 8,
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: top("activeUsers"),
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: Object.keys(SITE_EVENTS) } } },
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "searchTerm" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "search" } } },
        orderBys: top("eventCount"),
        limit: 10,
      },
      {
        dateRanges: [current],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: {
          filter: { fieldName: "pagePath", stringFilter: { matchType: "FULL_REGEXP", value: "^/winners/\\d+/\\d+/?$" } },
        },
        orderBys: top("screenPageViews"),
        limit: 10,
      },
    ]),
  ]);

  const total = (r?: ReportResponse) => {
    const row = r?.rows?.[0];
    return { users: row ? mets(row, 0) : 0, views: row ? mets(row, 1) : 0, sessions: row ? mets(row, 2) : 0 };
  };

  const report: GaReport = {
    days,
    totals: total(first[0]),
    previous: total(first[1]),
    daily: (first[2]?.rows ?? []).map((r) => ({ date: dims(r, 0), users: mets(r, 0), views: mets(r, 1) })),
    pages: (first[3]?.rows ?? []).map((r) => ({ path: dims(r, 0), title: dims(r, 1), views: mets(r, 0) })),
    channels: (first[4]?.rows ?? []).map((r) => ({ name: dims(r, 0), sessions: mets(r, 0) })),
    sources: (second[0]?.rows ?? []).map((r) => ({ name: dims(r, 0), sessions: mets(r, 0) })),
    devices: (second[1]?.rows ?? []).map((r) => ({ name: dims(r, 0), users: mets(r, 0) })),
    events: (second[2]?.rows ?? []).map((r) => ({ name: dims(r, 0), count: mets(r, 0) })),
    searchTerms: (second[3]?.rows ?? [])
      .map((r) => ({ term: dims(r, 0), count: mets(r, 0) }))
      .filter((t) => t.term && t.term !== "(not set)"),
    winnerPages: (second[4]?.rows ?? []).map((r) => ({ path: dims(r, 0), views: mets(r, 0) })),
  };
  cache.set(days, { at: Date.now(), report });
  return report;
}
