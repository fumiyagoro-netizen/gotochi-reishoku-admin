/** /api/campaigns/* の共通処理（権限・入力の検証） */
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getRoleFromRequest, getPermissions } from "./role";
import { getUserFromRequest } from "./auth";
import { jstDateStringToEndOfDayUtc } from "./award-dates";
import { isCampaignStatus, parseAwardIds } from "./retail-shared";

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

/** 企画の登録・編集・確定・案内（管理者のみ）。通れば操作したユーザーを返す */
export async function requireManage(request: Request) {
  const perms = getPermissions(await getRoleFromRequest(request));
  if (!perms.canManageCampaigns) return { error: fail("流通企画の登録・編集は管理者のみです", 403) };
  return { user: await getUserFromRequest(request) };
}

export interface CampaignInput {
  name: string;
  awardIds: number[];
  status: string;
  period: string;
  deadline: Date | null;
  description: string;
  memo: string;
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** 企画の入力を検証する。エラーなら文言を返す */
export async function parseCampaignInput(body: Record<string, unknown>): Promise<CampaignInput | string> {
  const name = str(body.name, 100);
  if (!name) return "企画名を入力してください";
  if (!isCampaignStatus(body.status)) return "状態の値が不正です";
  const requested = parseAwardIds(body.awardIds);
  const awards = requested.length
    ? await prisma.award.findMany({ where: { id: { in: requested } }, select: { id: true } })
    : [];
  const awardIds = awards.map((a) => a.id).sort((a, b) => a - b);
  if (awardIds.length === 0) return "対象年度を1つ以上選んでください";
  const deadlineRaw = str(body.deadline, 10);
  const deadline = deadlineRaw ? jstDateStringToEndOfDayUtc(deadlineRaw) : null;
  if (deadlineRaw && !deadline) return "回答締切の日付が不正です";
  return {
    name,
    awardIds,
    status: body.status,
    period: str(body.period, 100),
    deadline,
    description: str(body.description, 2000),
    memo: str(body.memo, 2000),
  };
}
