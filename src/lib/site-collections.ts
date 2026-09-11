import { prisma } from "./prisma";
import { jstDateStringToStartOfDayUtc } from "./award-dates";
import { isSiteAssetUrl } from "./site-api";
import {
  MAX_VOICE_PHOTOS,
  NEWS_CATEGORIES,
  PARTNER_KINDS,
  type SiteCollectionKind,
} from "./site-collections-shared";

/**
 * サイト管理の一覧画面（お知らせ・審査員・受賞者の声・パートナー）の保存ルール（サーバー専用）。
 * /api/site/[collection] の各ルートはここを通して作成・更新・削除・並べ替えする。
 * 入力はここで検証し直す（画面の検証は信用しない）。
 */

export type Row = Record<string, unknown> & { id: number };
type Data = Record<string, unknown>;

export type CollectionDef = {
  /** prisma のモデル名（prisma.siteNews など） */
  model: "siteNews" | "siteJudge" | "siteVoice" | "sitePartner";
  /** 操作ログに出す名前 */
  label: string;
  /** 入力を検証して保存する値にする。エラーならメッセージを返す */
  parse: (body: Data, isCreate: boolean) => Promise<{ data?: Data; error?: string }>;
  /** 操作ログの対象の書き方 */
  describe: (row: Row) => string;
  /** 行が持つサイト用ファイルの URL（差し替え・削除で古いものを消すため） */
  assetUrls: (row: Row) => string[];
  /** 並べ替えの単位（同じ値を持つ行の中で並べる）。undefined なら並べ替えなし */
  sortScope?: (row: Row) => Data;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown) => v === true || v === "true";

export const COLLECTIONS: Record<SiteCollectionKind, CollectionDef> = {
  news: {
    model: "siteNews",
    label: "お知らせ",
    async parse(body) {
      const title = str(body.title, 200);
      if (!title) return { error: "タイトルを入れてください" };
      const category = str(body.category, 20);
      if (!(NEWS_CATEGORIES as readonly string[]).includes(category)) return { error: "カテゴリを選んでください" };
      const dateStr = str(body.publishedAt, 10);
      const publishedAt = dateStr ? jstDateStringToStartOfDayUtc(dateStr) : null;
      if (dateStr && !publishedAt) return { error: "公開日は YYYY-MM-DD の形で入れてください" };
      return {
        data: {
          title,
          category,
          publishedAt,
          body: str(body.body, 20000),
          isPublished: bool(body.isPublished),
          isPinned: bool(body.isPinned),
        },
      };
    },
    describe: (r) => `「${r.title}」`,
    assetUrls: () => [],
  },

  judges: {
    model: "siteJudge",
    label: "審査員",
    async parse(body, isCreate) {
      const name = str(body.name, 100);
      if (!name) return { error: "氏名を入れてください" };
      const photoUrl = str(body.photoUrl, 1000);
      if (photoUrl && !isSiteAssetUrl(photoUrl)) return { error: "写真はこの画面からアップロードしてください" };
      const data: Data = {
        name,
        title: str(body.title, 200),
        role: str(body.role, 100),
        photoUrl,
        isPublished: bool(body.isPublished),
      };
      if (isCreate) {
        const awardId = Number(body.awardId);
        const award = Number.isInteger(awardId) ? await prisma.award.findUnique({ where: { id: awardId } }) : null;
        if (!award) return { error: "年度が見つかりません" };
        data.awardId = awardId;
      }
      return { data };
    },
    describe: (r) => `「${r.name}」`,
    assetUrls: (r) => [String(r.photoUrl ?? "")],
    sortScope: (r) => ({ awardId: r.awardId }),
  },

  voices: {
    model: "siteVoice",
    label: "受賞者の声",
    async parse(body) {
      const entryId = Number(body.entryId);
      const entry = Number.isInteger(entryId)
        ? await prisma.entry.findUnique({ where: { id: entryId }, select: { prizeLevel: true } })
        : null;
      if (!entry) return { error: "受賞商品を選んでください" };
      if (!entry.prizeLevel) return { error: "受賞していない商品には付けられません" };
      const quote = str(body.quote, 5000);
      if (!quote) return { error: "コメントを入れてください" };
      const photos = Array.isArray(body.photoUrls) ? body.photoUrls : [];
      if (photos.length > MAX_VOICE_PHOTOS) return { error: `写真は${MAX_VOICE_PHOTOS}枚までです` };
      if (!photos.every(isSiteAssetUrl)) return { error: "写真はこの画面からアップロードしてください" };
      return { data: { entryId, quote, photoUrls: photos, isPublished: bool(body.isPublished) } };
    },
    describe: (r) => `#${r.id}（エントリー ${r.entryId}）`,
    assetUrls: (r) => (Array.isArray(r.photoUrls) ? (r.photoUrls as unknown[]).map(String) : []),
    sortScope: () => ({}),
  },

  partners: {
    model: "sitePartner",
    label: "パートナー",
    async parse(body) {
      const kind = str(body.kind, 10);
      if (!(PARTNER_KINDS as readonly string[]).includes(kind)) return { error: "種別を選んでください" };
      const name = str(body.name, 200);
      if (!name) return { error: "名称を入れてください" };
      const url = str(body.url, 1000);
      if (url && !/^https?:\/\//.test(url)) return { error: "リンク先は http:// か https:// で始めてください" };
      const logoUrl = str(body.logoUrl, 1000);
      if (logoUrl && !isSiteAssetUrl(logoUrl)) return { error: "ロゴはこの画面からアップロードしてください" };
      return { data: { kind, name, url, logoUrl, isPublished: bool(body.isPublished) } };
    },
    describe: (r) => `「${r.name}」（${r.kind}）`,
    assetUrls: (r) => [String(r.logoUrl ?? "")],
    sortScope: (r) => ({ kind: r.kind }),
  },
};

export function isCollectionKind(value: string): value is SiteCollectionKind {
  return value in COLLECTIONS;
}

/** prisma のモデルを名前で引く（4つのモデルを同じ手順で扱うための最小の型） */
export type Delegate = {
  findUnique(args: { where: { id: number } }): Promise<Row | null>;
  findMany(args: { where: Data; select?: Data }): Promise<Row[]>;
  create(args: { data: Data }): Promise<Row>;
  update(args: { where: { id: number }; data: Data }): Promise<Row>;
  delete(args: { where: { id: number } }): Promise<Row>;
  aggregate(args: { where: Data; _max: { sortOrder: true } }): Promise<{ _max: { sortOrder: number | null } }>;
};

export function delegateOf(client: unknown, def: CollectionDef): Delegate {
  return (client as Record<string, Delegate>)[def.model];
}
