/**
 * 開催概要（SiteAwardSettings.overview の JSON）の形と検証。画面とサーバーの両方が使う。
 * 募集期間そのものは年度管理の受付期間（Award.entryStartDate / entryEndDate）を使い、ここでは持たない
 * （エントリーフォームの受付と公開サイトの表示がずれないように）。
 */

export type OverviewFee = { label: string; from: string; to: string; amount: number | null };
export type OverviewTimelineItem = { date: string; title: string; note: string };
export type SiteOverview = {
  /** 例: 第3回 日本全国！ご当地冷凍食品大賞 2027 */
  name: string;
  target: string;
  eligibility: string;
  /** エントリー費（税抜）。早期割引・通常・割増の3段階が基本 */
  fees: OverviewFee[];
  /** 例: 2027年1月下旬 プレス向け発表会・表彰式（予定） */
  announceText: string;
  exhibition: string;
  perks: string;
  timeline: OverviewTimelineItem[];
};

export const OVERVIEW_MAX_FEES = 5;
export const OVERVIEW_MAX_TIMELINE = 20;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function emptyOverview(): SiteOverview {
  return {
    name: "",
    target: "",
    eligibility: "",
    fees: ["早期割引", "通常", "割増"].map((label) => ({ label, from: "", to: "", amount: null })),
    announceText: "",
    exhibition: "",
    perks: "",
    timeline: [],
  };
}

/** 保存前・読み込み時に形を整える（型の違う値・長すぎる文字・空の行を落とす） */
export function normalizeOverview(raw: unknown): SiteOverview {
  if (!raw || typeof raw !== "object") return emptyOverview();
  const o = raw as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const d = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : "");
  const fees = Array.isArray(o.fees)
    ? o.fees.slice(0, OVERVIEW_MAX_FEES).map((f) => {
        const r = (f ?? {}) as Record<string, unknown>;
        const n = r.amount === "" || r.amount == null ? NaN : Number(r.amount);
        return { label: s(r.label, 30), from: d(r.from), to: d(r.to), amount: Number.isFinite(n) && n >= 0 ? Math.round(n) : null };
      })
    : emptyOverview().fees;
  const timeline = Array.isArray(o.timeline)
    ? o.timeline
        .slice(0, OVERVIEW_MAX_TIMELINE)
        .map((t) => {
          const r = (t ?? {}) as Record<string, unknown>;
          return { date: s(r.date, 40), title: s(r.title, 100), note: s(r.note, 200) };
        })
        .filter((t) => t.date || t.title || t.note)
    : [];
  return {
    name: s(o.name, 200),
    target: s(o.target, 1000),
    eligibility: s(o.eligibility, 1000),
    fees,
    announceText: s(o.announceText, 200),
    exhibition: s(o.exhibition, 300),
    perks: s(o.perks, 2000),
    timeline,
  };
}

function nextDay(date: string): string {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/** エントリー費の期間の食い違い（未入力・逆転・すき間・重なり・受付期間とのずれ）。保存は止めず、画面で知らせる */
export function feeProblems(fees: OverviewFee[], entryStart: string, entryEnd: string): string[] {
  const used = fees.filter((f) => f.label || f.from || f.to || f.amount != null);
  const problems: string[] = [];
  for (const f of used) {
    const name = f.label || "（区分名なし）";
    if (!f.from || !f.to) problems.push(`${name}の期間が入っていません`);
    else if (f.from > f.to) problems.push(`${name}の終了日が開始日より前です`);
    if (f.amount == null) problems.push(`${name}の金額が入っていません`);
  }
  const dated = used.filter((f) => f.from && f.to).sort((a, b) => a.from.localeCompare(b.from));
  for (let i = 1; i < dated.length; i++) {
    const expected = nextDay(dated[i - 1].to);
    if (dated[i].from > expected) problems.push(`${dated[i - 1].label}と${dated[i].label}のあいだに空きがあります（${expected}〜）`);
    else if (dated[i].from < expected) problems.push(`${dated[i - 1].label}と${dated[i].label}の期間が重なっています`);
  }
  if (dated.length > 0 && entryStart && dated[0].from !== entryStart) {
    problems.push(`最初の区分の開始日（${dated[0].from}）が受付開始日（${entryStart}）と違います`);
  }
  if (dated.length > 0 && entryEnd && dated[dated.length - 1].to !== entryEnd) {
    problems.push(`最後の区分の終了日（${dated[dated.length - 1].to}）が受付終了日（${entryEnd}）と違います`);
  }
  return problems;
}
