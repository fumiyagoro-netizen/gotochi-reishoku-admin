import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { sendTransactionalBatch, transactionalFooterHtml } from "@/lib/email";
import { fail, requireManage } from "@/lib/retail-api";
import {
  ensureInvite,
  inviteValuesFor,
  loadAnswererGroups,
  regenerateInvite,
  renderInviteHtml,
  renderInviteSubject,
  retailPageUrl,
  type AnswererGroup,
} from "@/lib/retail";
import { isValidEmail, normalizeEmail } from "@/lib/retail-shared";

export const maxDuration = 60;

function wrapHtml(inner: string, footer: string): string {
  return `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.8;">${inner}${footer}</div>`;
}

async function render(group: AnswererGroup, subject: string, body: string) {
  const invite = await ensureInvite(group.email);
  const values = inviteValuesFor(group, retailPageUrl(invite.token));
  return {
    subject: renderInviteSubject(subject, values),
    html: wrapHtml(renderInviteHtml(body, values), await transactionalFooterHtml()),
  };
}

// POST: 案内・申請URL の操作（管理者のみ）。action で分ける
// - url:        担当者の申請ページのURLを返す（無ければ作る）
// - regenerate: URLを作り直す（古いURLは開けなくなる）
// - preview:    案内メールの差し込み結果（送らない）
// - test:       見本の担当者の内容で、指定したアドレスにだけ送る
// - send:       選んだ担当者に送る（配信停止のアドレスは除く）
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireManage(request);
    if (error) return error;

    const body = await request.json();
    const action = String(body.action ?? "");
    const { groups } = await loadAnswererGroups();
    const groupOf = new Map(groups.map((g) => [g.email, g]));
    // 募集中の企画の対象になっている担当者だけを扱う（関係のないアドレスに URL を作らない）
    const pick = (email: unknown) => groupOf.get(normalizeEmail(String(email ?? "")));

    if (action === "url" || action === "regenerate") {
      const group = pick(body.email);
      if (!group) return fail("募集中の企画の対象になっている担当者ではありません", 404);
      const invite = action === "url" ? await ensureInvite(group.email) : await regenerateInvite(group.email);
      if (action === "regenerate") {
        await writeAuditLog({
          userId: user?.userId,
          userEmail: user?.email,
          action: "retail_invite",
          target: "retail_invite",
          targetId: String(invite.id),
          detail: `申請ページのURLを作り直し: ${group.email}`,
        });
      }
      return NextResponse.json({ success: true, url: retailPageUrl(invite.token) });
    }

    const subject = String(body.subject ?? "").trim();
    const text = String(body.body ?? "");
    if (!subject || !text.trim()) return fail("件名と本文を入力してください");
    if (!/\{\{\s*url\s*\}\}/.test(text)) return fail("本文に {{url}}（申請ページのURL）を入れてください");

    if (action === "preview" || action === "test") {
      const group = pick(body.email);
      if (!group) return fail("見本の担当者が見つかりません", 404);
      const rendered = await render(group, subject, text);
      if (action === "preview") return NextResponse.json({ success: true, preview: rendered });

      const to = normalizeEmail(String(body.testEmail ?? ""));
      if (!isValidEmail(to)) return fail("テスト送信先のメールアドレスが正しくありません");
      const [ok] = await sendTransactionalBatch([{ to, subject: `[テスト送信] ${rendered.subject}`, html: rendered.html }], user?.email);
      return ok ? NextResponse.json({ success: true }) : fail("テスト送信に失敗しました", 502);
    }

    if (action === "send") {
      const emails: unknown[] = Array.isArray(body.emails) ? body.emails : [];
      const targets = [...new Set(emails.map((e) => normalizeEmail(String(e))))]
        .map((e) => groupOf.get(e))
        .filter((g): g is AnswererGroup => !!g);
      if (targets.length === 0) return fail("送り先を選んでください");
      const sendable = targets.filter((g) => !g.suppressed);
      const skipped = targets.length - sendable.length;

      const messages = [];
      for (const g of sendable) messages.push({ to: g.email, ...(await render(g, subject, text)) });
      const ok = await sendTransactionalBatch(messages, user?.email);
      const sentEmails = sendable.filter((_g, i) => ok[i]).map((g) => g.email);
      if (sentEmails.length > 0) {
        await prisma.retailInvite.updateMany({ where: { email: { in: sentEmails } }, data: { lastSentAt: new Date() } });
      }
      const sent = sentEmails.length;
      const failed = sendable.length - sent;
      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "retail_invite",
        target: "retail_invite",
        detail: `流通企画の案内メール「${subject}」: ${sent}件送信, ${failed}件失敗, ${skipped}件は配信停止のため除外`,
      });
      return NextResponse.json({ success: true, sent, failed, skipped });
    }

    return fail("操作が不正です");
  } catch (err) {
    console.error("Campaign invites error:", err);
    return fail("処理に失敗しました", 500);
  }
}
