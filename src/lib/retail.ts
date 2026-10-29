/**
 * 流通企画（/campaigns）のサーバー側の処理。
 *
 * - 企画の対象 = 企画の対象年度（RetailCampaign.awardIds）の受賞商品（prizeLevel が空でない Entry）
 * - 企業は担当者（メールアドレス）ごとの申請ページ /retail/<token> から回答する。商品を答える担当者は
 *   RetailEntryContact（事務局が差し替えた案内先）があればそちら、無ければエントリーのメールアドレス
 * - RetailCampaignItem は回答か確定が入ったときに作る（行が無い＝未回答・未定）
 */
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { GRAND_PRIX_TITLE } from "./prize-shared";
import { isAnswerable, normalizeEmail, parseAwardIds, type InviteTag } from "./retail-shared";

const APP_URL = process.env.APP_URL || "https://dashboard.gotouchireisyoku.com";

const PRIZE_ORDER: Record<string, number> = { 最高金賞: 1, 金賞: 2, 銀賞: 3, 銅賞: 4 };

export function retailPageUrl(token: string): string {
  return `${APP_URL}/retail/${token}`;
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** 担当者の申請ページのURLを取る（無ければ作る） */
export async function ensureInvite(email: string) {
  const key = normalizeEmail(email);
  const found = await prisma.retailInvite.findUnique({ where: { email: key } });
  if (found) return found;
  return prisma.retailInvite.upsert({
    where: { email: key },
    update: {},
    create: { email: key, token: newToken() },
  });
}

/** URLを作り直す。古いURLは開けなくなる */
export async function regenerateInvite(email: string) {
  const key = normalizeEmail(email);
  return prisma.retailInvite.upsert({
    where: { email: key },
    update: { token: newToken() },
    create: { email: key, token: newToken() },
  });
}

// ---------------------------------------------------------------- 対象の受賞商品

const PRODUCT_SELECT = {
  id: true,
  awardId: true,
  productName: true,
  companyName: true,
  contactLastName: true,
  contactFirstName: true,
  email: true,
  phone: true,
  prizeLevel: true,
  award: { select: { year: true } },
  titles: { where: { name: GRAND_PRIX_TITLE }, select: { id: true } },
  retailContact: { select: { email: true, name: true } },
  images: { where: { imageType: "main" }, take: 1, select: { id: true } },
} as const;

export interface RetailProduct {
  id: number;
  awardId: number;
  year: number;
  productName: string;
  companyName: string;
  prizeLevel: string;
  grandPrix: boolean;
  /** 回答する担当者のメールアドレス（照合用に正規化済み） */
  answererEmail: string;
  /** 回答する担当者の宛名 */
  answererName: string;
  /** 案内先を事務局が差し替えているか */
  contactOverridden: boolean;
  /** エントリー時の担当者・連絡先（差し替えの画面で見せる） */
  entryEmail: string;
  entryContactName: string;
  entryPhone: string;
  /** 管理画面のサムネイル（/api/images/<id>） */
  mainImageId: number | null;
}

type ProductRow = {
  id: number;
  awardId: number;
  productName: string;
  companyName: string;
  contactLastName: string;
  contactFirstName: string;
  email: string;
  phone: string;
  prizeLevel: string;
  award: { year: number };
  titles: { id: number }[];
  retailContact: { email: string; name: string } | null;
  images: { id: number }[];
};

function toProduct(e: ProductRow): RetailProduct {
  const entryContactName = `${e.contactLastName} ${e.contactFirstName}`.trim();
  return {
    id: e.id,
    awardId: e.awardId,
    year: e.award.year,
    productName: e.productName,
    companyName: e.companyName,
    prizeLevel: e.prizeLevel,
    grandPrix: e.titles.length > 0,
    answererEmail: normalizeEmail(e.retailContact?.email || e.email),
    answererName: e.retailContact ? e.retailContact.name : entryContactName,
    contactOverridden: !!e.retailContact,
    entryEmail: e.email,
    entryContactName,
    entryPhone: e.phone,
    mainImageId: e.images[0]?.id ?? null,
  };
}

/** 年度の新しい順 → 賞の順 → グランプリ先頭 → 商品名 */
export function compareProducts(a: RetailProduct, b: RetailProduct): number {
  return (
    b.year - a.year ||
    (PRIZE_ORDER[a.prizeLevel] || 99) - (PRIZE_ORDER[b.prizeLevel] || 99) ||
    Number(b.grandPrix) - Number(a.grandPrix) ||
    a.productName.localeCompare(b.productName, "ja")
  );
}

/** 指定した年度の受賞商品 */
export async function loadWinnerProducts(awardIds: number[]): Promise<RetailProduct[]> {
  if (awardIds.length === 0) return [];
  const rows = await prisma.entry.findMany({
    where: { awardId: { in: awardIds }, prizeLevel: { not: "" } },
    select: PRODUCT_SELECT,
  });
  return rows.map(toProduct).sort(compareProducts);
}

/** 指定した商品（対象年度から外れた商品の行を出すときなど） */
export async function loadProductsByIds(ids: number[]): Promise<RetailProduct[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.entry.findMany({ where: { id: { in: ids } }, select: PRODUCT_SELECT });
  return rows.map(toProduct).sort(compareProducts);
}

// ---------------------------------------------------------------- 企画の一覧と集計

export interface CampaignSummary {
  id: number;
  name: string;
  period: string;
  status: string;
  deadline: Date | null;
  awardIds: number[];
  years: number[];
  targetCount: number;
  yes: number;
  no: number;
  unanswered: number;
  adopted: number;
  declined: number;
  lastRespondedAt: Date | null;
}

export async function loadCampaignSummaries(): Promise<CampaignSummary[]> {
  const [campaigns, awards] = await Promise.all([
    prisma.retailCampaign.findMany({
      orderBy: { id: "desc" },
      include: { items: { select: { entryId: true, response: true, decision: true, respondedAt: true } } },
    }),
    prisma.award.findMany({ select: { id: true, year: true } }),
  ]);
  const yearOf = new Map(awards.map((a) => [a.id, a.year]));
  const allAwardIds = [...new Set(campaigns.flatMap((c) => parseAwardIds(c.awardIds)))];
  const winners = allAwardIds.length
    ? await prisma.entry.findMany({
        where: { awardId: { in: allAwardIds }, prizeLevel: { not: "" } },
        select: { id: true, awardId: true },
      })
    : [];

  return campaigns.map((c) => {
    const awardIds = parseAwardIds(c.awardIds);
    const target = new Set(winners.filter((w) => awardIds.includes(w.awardId)).map((w) => w.id));
    // 対象年度から外れた商品の回答も数える（年度を変えても記録は消さない）
    for (const item of c.items) if (item.response || item.decision) target.add(item.entryId);
    const items = c.items;
    const yes = items.filter((i) => i.response === "yes").length;
    const no = items.filter((i) => i.response === "no").length;
    const last = items.reduce<Date | null>(
      (max, i) => (i.respondedAt && (!max || i.respondedAt > max) ? i.respondedAt : max),
      null,
    );
    return {
      id: c.id,
      name: c.name,
      period: c.period,
      status: c.status,
      deadline: c.deadline,
      awardIds,
      years: awardIds.map((id) => yearOf.get(id)).filter((y): y is number => !!y).sort((a, b) => b - a),
      targetCount: target.size,
      yes,
      no,
      unanswered: target.size - yes - no,
      adopted: items.filter((i) => i.decision === "adopted").length,
      declined: items.filter((i) => i.decision === "declined").length,
      lastRespondedAt: last,
    };
  });
}

// ---------------------------------------------------------------- 企画の詳細

export interface CampaignItemRow extends RetailProduct {
  /** 対象年度から外れた商品（年度を変える前に回答・確定が入っていたもの） */
  outOfScope: boolean;
  response: string;
  respondedAt: string | null;
  respondedVia: string;
  respondentName: string;
  respondentContact: string;
  companyNote: string;
  decision: string;
  decidedAt: string | null;
  staffMemo: string;
}

/** 企画の対象商品と、それぞれの回答・確定（行が無い商品は未回答・未定） */
export async function loadCampaignRows(campaign: { id: number; awardIds: unknown }): Promise<CampaignItemRow[]> {
  const awardIds = parseAwardIds(campaign.awardIds);
  const [products, items] = await Promise.all([
    loadWinnerProducts(awardIds),
    prisma.retailCampaignItem.findMany({ where: { campaignId: campaign.id } }),
  ]);
  const inScope = new Set(products.map((p) => p.id));
  const extraIds = items.filter((i) => !inScope.has(i.entryId) && (i.response || i.decision)).map((i) => i.entryId);
  const extra = await loadProductsByIds(extraIds);
  const itemOf = new Map(items.map((i) => [i.entryId, i]));

  return [...products, ...extra].map((p) => {
    const item = itemOf.get(p.id);
    return {
      ...p,
      outOfScope: !inScope.has(p.id),
      response: item?.response ?? "",
      respondedAt: item?.respondedAt?.toISOString() ?? null,
      respondedVia: item?.respondedVia ?? "",
      respondentName: item?.respondentName ?? "",
      respondentContact: item?.respondentContact ?? "",
      companyNote: item?.companyNote ?? "",
      decision: item?.decision ?? "",
      decidedAt: item?.decidedAt?.toISOString() ?? null,
      staffMemo: item?.staffMemo ?? "",
    };
  });
}

// ---------------------------------------------------------------- 担当者ごとのまとまり（案内・URL）

export interface AnswererGroup {
  email: string;
  name: string;
  companies: string[];
  products: RetailProduct[];
  /** 募集中の企画 × 商品のうち、回答の要る組み合わせの数と回答済みの数 */
  pairCount: number;
  answeredCount: number;
  campaignNames: string[];
  invite: { token: string; lastSentAt: Date | null; lastAnsweredAt: Date | null } | null;
  suppressed: boolean;
}

/** 募集中の企画の対象商品を、回答する担当者（メールアドレス）ごとにまとめる */
export async function loadAnswererGroups(): Promise<{ groups: AnswererGroup[]; openCampaigns: { id: number; name: string; awardIds: number[] }[] }> {
  const campaigns = await prisma.retailCampaign.findMany({ where: { status: "open" }, orderBy: { id: "asc" } });
  const openCampaigns = campaigns.map((c) => ({ id: c.id, name: c.name, awardIds: parseAwardIds(c.awardIds) }));
  const awardIds = [...new Set(openCampaigns.flatMap((c) => c.awardIds))];
  const products = await loadWinnerProducts(awardIds);
  if (products.length === 0) return { groups: [], openCampaigns };

  const [items, invites, suppressions] = await Promise.all([
    prisma.retailCampaignItem.findMany({
      where: { campaignId: { in: openCampaigns.map((c) => c.id) }, entryId: { in: products.map((p) => p.id) } },
      select: { campaignId: true, entryId: true, response: true },
    }),
    prisma.retailInvite.findMany(),
    prisma.suppression.findMany({ select: { email: true } }),
  ]);
  const answered = new Set(items.filter((i) => i.response).map((i) => `${i.campaignId}:${i.entryId}`));
  const inviteOf = new Map(invites.map((i) => [i.email, i]));
  const suppressed = new Set(suppressions.map((s) => normalizeEmail(s.email)));

  const byEmail = new Map<string, RetailProduct[]>();
  for (const p of products) {
    const list = byEmail.get(p.answererEmail) ?? [];
    list.push(p);
    byEmail.set(p.answererEmail, list);
  }

  const groups: AnswererGroup[] = [...byEmail.entries()].map(([email, list]) => {
    let pairCount = 0;
    let answeredCount = 0;
    const names = new Set<string>();
    for (const p of list) {
      for (const c of openCampaigns) {
        if (!c.awardIds.includes(p.awardId)) continue;
        pairCount++;
        names.add(c.name);
        if (answered.has(`${c.id}:${p.id}`)) answeredCount++;
      }
    }
    const invite = inviteOf.get(email);
    return {
      email,
      // 宛名は最新年度の商品の担当者（list は年度の新しい順）
      name: list.find((p) => p.answererName)?.answererName ?? "",
      companies: [...new Set(list.map((p) => p.companyName))],
      products: list,
      pairCount,
      answeredCount,
      campaignNames: openCampaigns.filter((c) => names.has(c.name)).map((c) => c.name),
      invite: invite ? { token: invite.token, lastSentAt: invite.lastSentAt, lastAnsweredAt: invite.lastAnsweredAt } : null,
      suppressed: suppressed.has(email),
    };
  });
  groups.sort((a, b) => a.companies[0].localeCompare(b.companies[0], "ja") || a.email.localeCompare(b.email));
  return { groups, openCampaigns };
}

// ---------------------------------------------------------------- 申請ページ

export interface RetailPageCampaign {
  id: number;
  name: string;
  period: string;
  description: string;
  deadline: Date | null;
  answerable: boolean;
}

export interface RetailPageProduct extends RetailProduct {
  /** この商品が対象の募集中の企画と、いまの回答 */
  answers: { campaignId: number; response: string; companyNote: string }[];
}

export interface RetailPageData {
  inviteEmail: string;
  campaigns: RetailPageCampaign[];
  products: RetailPageProduct[];
  respondentName: string;
  respondentContact: string;
}

/** token の担当者が答える商品と、募集中の企画。token が無効なら null */
export async function loadRetailPage(token: string): Promise<RetailPageData | null> {
  if (!token || token.length > 100) return null;
  const invite = await prisma.retailInvite.findUnique({ where: { token } });
  if (!invite) return null;

  const campaigns = await prisma.retailCampaign.findMany({ where: { status: "open" }, orderBy: { id: "asc" } });
  const awardIdsOf = new Map(campaigns.map((c) => [c.id, parseAwardIds(c.awardIds)]));
  const products = (await loadWinnerProducts([...new Set([...awardIdsOf.values()].flat())])).filter(
    (p) => p.answererEmail === invite.email,
  );
  const items = products.length
    ? await prisma.retailCampaignItem.findMany({
        where: { entryId: { in: products.map((p) => p.id) }, campaignId: { in: campaigns.map((c) => c.id) } },
      })
    : [];
  const itemOf = new Map(items.map((i) => [`${i.campaignId}:${i.entryId}`, i]));

  const pageProducts: RetailPageProduct[] = products.map((p) => ({
    ...p,
    answers: campaigns
      .filter((c) => awardIdsOf.get(c.id)!.includes(p.awardId))
      .map((c) => {
        const item = itemOf.get(`${c.id}:${p.id}`);
        return { campaignId: c.id, response: item?.response ?? "", companyNote: item?.companyNote ?? "" };
      }),
  }));
  const used = new Set(pageProducts.flatMap((p) => p.answers.map((a) => a.campaignId)));

  // 回答者の初期値: 前回この画面から答えた人 → エントリー時の担当者
  const last = items
    .filter((i) => i.respondedVia === "form" && i.respondentName)
    .sort((a, b) => (b.respondedAt?.getTime() ?? 0) - (a.respondedAt?.getTime() ?? 0))[0];
  const first = products[0];

  return {
    inviteEmail: invite.email,
    campaigns: campaigns
      .filter((c) => used.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        period: c.period,
        description: c.description,
        deadline: c.deadline,
        answerable: isAnswerable(c),
      })),
    products: pageProducts,
    respondentName: last?.respondentName ?? first?.answererName ?? "",
    respondentContact: last?.respondentContact ?? (first && !first.contactOverridden ? first.entryPhone : ""),
  };
}

// ---------------------------------------------------------------- 案内メール

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type InviteValues = Record<InviteTag, string>;

const TAG_RE = /\{\{\s*(name|company|products|campaigns|url)\s*\}\}/g;

/** 件名の差し込み（メールの件名は文字のまま） */
export function renderInviteSubject(subject: string, values: InviteValues): string {
  return subject.replace(TAG_RE, (_m, tag: InviteTag) => (tag === "url" ? "" : values[tag]).replace(/\n/g, " "));
}

/**
 * 本文の差し込み。本文は文字で書いてもらい（HTML は使わない）、ここでエスケープして改行を <br> にする。
 * {{url}} はリンクにする
 */
export function renderInviteHtml(body: string, values: InviteValues): string {
  const parts = body.split(TAG_RE);
  // split に捕獲グループがあるので [文, タグ, 文, タグ, …] の並びになる
  const html = parts
    .map((part, i) => {
      if (i % 2 === 0) return escapeHtml(part);
      const tag = part as InviteTag;
      if (tag === "url") {
        const url = escapeHtml(values.url);
        return `<a href="${url}" style="color:#0A4F8F;word-break:break-all;">${url}</a>`;
      }
      return escapeHtml(values[tag]);
    })
    .join("")
    .replace(/\r?\n/g, "<br>");
  return html;
}

export function inviteValuesFor(group: AnswererGroup, url: string): InviteValues {
  return {
    name: group.name || "ご担当者",
    company: group.companies.join("、"),
    products: group.products.map((p) => `・${p.productName}（${p.year}年度 ${p.prizeLevel}）`).join("\n"),
    campaigns: group.campaignNames.map((n) => `・${n}`).join("\n"),
    url,
  };
}
