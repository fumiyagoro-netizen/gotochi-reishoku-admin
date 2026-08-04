import { Resend } from "resend";
import { prisma } from "./prisma";
import { getEmailFooterSettings } from "./settings";

// The Resend client is created on first send rather than at module scope:
// `new Resend(undefined)` throws immediately, which fails `next build` (page
// data collection imports this module) in any environment without
// RESEND_API_KEY. Every sender below already checks the key before calling
// getResend(), so a missing key degrades to "skip the send", not a crash.
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@gotouchireisyoku.com";
const FROM_NAME = "ご当地冷凍食品大賞 事務局";

// Reply-To for all outgoing mail is the admin-configured contact address
// (Settings > contact_email), not a hardcoded value: this lets recipients
// actually reach the office by hitting "reply", without changing From (which
// would risk the domain's SPF/DKIM authentication). Several senders below
// (e.g. sendEntryConfirmation + sendAdminNotification) fire concurrently for
// a single request, so concurrent getEmailFooterSettings() calls are
// coalesced into one query here; the in-flight promise is cleared once it
// settles, so later calls still read fresh data (no stale caching).
let footerSettingsInFlight: Promise<Awaited<ReturnType<typeof getEmailFooterSettings>>> | null = null;
function getFooterSettingsShared() {
  if (!footerSettingsInFlight) {
    footerSettingsInFlight = getEmailFooterSettings().finally(() => {
      footerSettingsInFlight = null;
    });
  }
  return footerSettingsInFlight;
}

// Marketing (Contact list) email sender - same domain as transactional email
const MARKETING_FROM_EMAIL = process.env.MARKETING_FROM_EMAIL || "noreply@gotouchireisyoku.com";
const MARKETING_FROM_NAME = process.env.MARKETING_FROM_NAME || "ご当地冷凍食品大賞 事務局";
const APP_URL = process.env.APP_URL || "https://dashboard.gotouchireisyoku.com";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  // Optional acting admin, for callers that have one (e.g. the review-status
  // change notification in src/app/api/entries/[id]/route.ts). Most callers
  // of sendEmail() (entry confirmation, admin notification, form auto-reply)
  // are triggered by a public form submission, not an admin action, so this
  // is left unset there and the EmailLog row's sentBy stays "".
  sentBy?: string;
}

// This is the single low-level sender behind every transactional email flow
// (entry confirmation, admin notification, review-status-change notices,
// form builder notifications/auto-replies — see the wrapper functions below,
// plus the two direct callers in src/app/api/entries/[id]/route.ts and
// src/app/api/entries/bulk-review/route.ts). It previously sent mail without
// ever recording an EmailLog row, so none of these sends were visible in the
// admin UI or trackable for delivery status. Logging here — rather than in
// each wrapper — covers all of those call sites in one place and captures
// Resend's message id so /api/webhooks/resend can later attach
// delivered/bounced/complained status to this exact row.
export async function sendEmail({ to, subject, html, sentBy }: SendEmailParams) {
  const toEmail = Array.isArray(to) ? to.join(", ") : to;

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    await prisma.emailLog.create({
      data: { toEmail, subject, status: "failed", sentBy: sentBy || "" },
    });
    return null;
  }

  try {
    const { contactEmail } = await getFooterSettingsShared();

    const result = await getResend().emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      // Omit entirely (rather than sending an empty string) when unset, so
      // we never send an invalid Reply-To header.
      ...(contactEmail ? { replyTo: contactEmail } : {}),
    });

    await prisma.emailLog.create({
      data: {
        toEmail,
        subject,
        status: result.error ? "failed" : "sent",
        sentBy: sentBy || "",
        messageId: result.data?.id ?? "",
      },
    });

    return result;
  } catch (error) {
    console.error("Email send error:", error);
    await prisma.emailLog.create({
      data: { toEmail, subject, status: "failed", sentBy: sentBy || "" },
    });
    return null;
  }
}

// Entry confirmation email to applicant
export async function sendEntryConfirmation(params: {
  to: string;
  answerNo: string;
  companyName: string;
  productName: string;
  contactName: string;
  awardName: string;
}) {
  const { to, answerNo, companyName, productName, contactName, awardName } = params;

  return sendEmail({
    to,
    subject: `【${awardName}】エントリーを受け付けました（${answerNo}）`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">
          ${awardName} エントリー受付完了
        </h2>
        <p>${contactName} 様</p>
        <p>この度は「${awardName}」にエントリーいただき、誠にありがとうございます。<br>
        以下の内容でエントリーを受け付けました。</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">受付番号</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${answerNo}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">企業名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${companyName}</td>
          </tr>
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">商品名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${productName}</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">
          審査結果は後日ご連絡いたします。<br>
          ご不明点がございましたら事務局までお問い合わせください。
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          一般社団法人未来の食卓<br>
          ご当地冷凍食品大賞 事務局
        </p>
      </div>
    `,
  });
}

// Notification email to admin(s)
export async function sendAdminNotification(params: {
  to: string[];
  answerNo: string;
  companyName: string;
  productName: string;
  contactName: string;
  email: string;
  phone: string;
  awardName: string;
}) {
  const { to, answerNo, companyName, productName, contactName, email, phone, awardName } = params;

  if (to.length === 0) return null;

  return sendEmail({
    to,
    subject: `【新規エントリー】${productName}（${companyName}）- ${answerNo}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px;">
          新規エントリー通知
        </h2>
        <p>${awardName}に新しいエントリーがありました。</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">受付番号</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${answerNo}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">企業名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${companyName}</td>
          </tr>
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">商品名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${productName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">担当者</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${contactName}</td>
          </tr>
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">メール</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">電話番号</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${phone || "未入力"}</td>
          </tr>
        </table>
        <p style="font-size: 14px;">
          <a href="https://dashboard.gotouchireisyoku.com/entries" style="color: #1e40af;">管理画面でエントリーを確認 →</a>
        </p>
      </div>
    `,
  });
}

// Review pass notification email
export async function sendReviewPassNotification(params: {
  to: string;
  contactName: string;
  productName: string;
  companyName: string;
  reviewStage: string; // "1次審査" or "2次審査"
  awardName: string;
}) {
  const { to, contactName, productName, companyName, reviewStage, awardName } = params;

  return sendEmail({
    to,
    subject: `【${awardName}】${reviewStage}通過のお知らせ`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 10px;">
          ${reviewStage}通過のお知らせ
        </h2>
        <p>${contactName} 様</p>
        <p>この度は「${awardName}」にエントリーいただき、誠にありがとうございます。</p>
        <p>厳正な審査の結果、貴社の下記商品が<strong>${reviewStage}を通過</strong>いたしましたので、お知らせいたします。</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #fef3c7;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">企業名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold;">商品名</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${productName}</td>
          </tr>
        </table>
        <p style="color: #6b7280; font-size: 14px;">
          今後の審査についてはあらためてご連絡いたします。<br>
          引き続きよろしくお願いいたします。
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          一般社団法人未来の食卓<br>
          ご当地冷凍食品大賞 事務局
        </p>
      </div>
    `,
  });
}

// ---- Marketing (Contact list) email ----

interface MarketingRecipient {
  email: string;
  name?: string;
  /** Optional caller-supplied company name for the {{company}} merge tag.
   *  When omitted, falls back to a Contact lookup by email (existing
   *  behavior, unchanged for callers that don't set this — e.g. the
   *  Contact/ContactList marketing flow at /api/contacts/send). */
  company?: string;
}

interface SendMarketingEmailParams {
  recipients: MarketingRecipient[];
  subject: string;
  html: string;
  sentBy?: string;
  defaultName?: string;
}

interface SendMarketingEmailResult {
  sent: number;
  failed: number;
  skipped: number;
}

function buildFooterHtml(footer: {
  senderName: string;
  orgName: string;
  postalAddress: string;
  contactEmail: string;
  contactTel: string;
}): string {
  return `
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #9ca3af; font-size: 12px; line-height: 1.6;">
      ${footer.orgName}<br>
      ${footer.senderName}<br>
      ${footer.postalAddress ? `${footer.postalAddress}<br>` : ""}
      お問い合わせ: ${footer.contactEmail}${footer.contactTel ? ` / ${footer.contactTel}` : ""}
    </p>
  `;
}

// Merge tag values available for personalization
interface MergeTagValues {
  name?: string;
  company?: string;
  email?: string;
}

// Replace {{tag}} / {{tag|fallback}} occurrences with values from `values`.
// If a tag has no fallback and its value is empty, `defaultName` is used for
// the `name` tag only; other tags fall back to an empty string.
export function applyMergeTags(text: string, values: MergeTagValues, defaultName: string = "ご担当者様"): string {
  return text.replace(/\{\{\s*(name|company|email)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g, (_match, tag: string, fallback?: string) => {
    const raw = values[tag as keyof MergeTagValues];
    if (raw) return raw;
    if (fallback !== undefined) return fallback;
    if (tag === "name") return defaultName;
    return "";
  });
}

// Convert a plain-text body into HTML line breaks. If the body already contains
// block-level HTML (br/p/div/table/list/heading), it is treated as authored HTML
// and left untouched so power users keep full control.
export function normalizeBodyHtml(body: string): string {
  const hasBlockHtml = /<(br|p|div|table|ul|ol|li|h[1-6])\b/i.test(body);
  if (hasBlockHtml) return body;
  return body.replace(/\r\n?/g, "\n").replace(/\n/g, "<br>\n");
}

// Render subject and html for a single recipient (merge tags applied to both;
// plain-text bodies also get automatic line breaks).
function renderForRecipient(
  subject: string,
  html: string,
  values: MergeTagValues,
  defaultName?: string
): { subject: string; html: string } {
  return {
    subject: applyMergeTags(subject, values, defaultName),
    html: applyMergeTags(normalizeBodyHtml(html), values, defaultName),
  };
}

// ---- Form builder admin notification email ----

// Minimal HTML-escaping for values that originate from public form
// submissions (anyone can POST to /api/forms/[id]/submit). Unlike the
// entry-flow emails above, this notification renders an arbitrary,
// admin-defined set of fields, so every label/value must be escaped before
// being interpolated into the HTML string.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SendFormAdminNotificationParams {
  to: string[];
  formTitle: string;
  formId: number;
  answers: Array<{ label: string; value: string }>;
  submissionId?: number;
}

// Notifies admins of a new form-builder submission. Field definitions are
// dynamic per-form, so (unlike sendAdminNotification's fixed Entry columns)
// this renders a generic label/value table from whatever fields the form
// author configured. Callers (handleFormSubmission) are expected to
// catch/log errors so a send failure never blocks the underlying form
// submission from succeeding.
export async function sendFormAdminNotification({
  to,
  formTitle,
  formId,
  answers,
  submissionId,
}: SendFormAdminNotificationParams) {
  if (to.length === 0) return null;

  const rows = answers
    .map(
      (a, i) => `
          <tr style="background: ${i % 2 === 0 ? "#f3f4f6" : "#ffffff"};">
            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: bold; width: 140px;">${escapeHtml(a.label)}</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${escapeHtml(a.value) || "未入力"}</td>
          </tr>`
    )
    .join("");

  return sendEmail({
    to,
    subject: `【フォーム回答】${formTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px;">
          新規フォーム回答通知
        </h2>
        <p>「${escapeHtml(formTitle)}」に新しい回答がありました。</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          ${rows}
        </table>
        <p style="font-size: 14px;">
          <a href="${APP_URL}/forms/${formId}/submissions" style="color: #1e40af;">管理画面で回答を確認 →</a>
        </p>
      </div>
    `,
  });
}

// ---- Form builder auto-reply email ----

interface SendFormAutoReplyParams {
  to: string;
  subject: string;
  body: string; // admin-authored subject/body; supports {{name}} / {{company}} merge tags
  name?: string;
  company?: string;
}

// Sends the form's configured auto-reply to the respondent. Merge tags are
// applied and plain-text line breaks are normalized to <br>, reusing the
// same renderer as marketing email. Callers (handleFormSubmission) are
// expected to catch/log errors so a send failure never blocks the
// underlying form submission from succeeding.
export async function sendFormAutoReply({ to, subject, body, name, company }: SendFormAutoReplyParams) {
  const values: MergeTagValues = { name, company, email: to };
  const rendered = renderForRecipient(subject, body, values);

  return sendEmail({
    to,
    subject: rendered.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${rendered.html}
      </div>
    `,
  });
}

export async function sendMarketingEmail({
  recipients,
  subject,
  html,
  sentBy,
  defaultName,
}: SendMarketingEmailParams): Promise<SendMarketingEmailResult> {
  const result: SendMarketingEmailResult = { sent: 0, failed: 0, skipped: 0 };
  if (recipients.length === 0) return result;

  const emails = recipients.map((r) => r.email);

  // Exclude suppressed and unsubscribed contacts
  const [suppressions, unsubscribedContacts] = await Promise.all([
    prisma.suppression.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    }),
    prisma.contact.findMany({
      where: { email: { in: emails }, subscribed: false },
      select: { email: true, companyName: true },
    }),
  ]);

  const suppressedSet = new Set(suppressions.map((s) => s.email));
  const unsubscribedSet = new Set(unsubscribedContacts.map((c) => c.email));

  // Look up company names for merge tag support
  const contacts = await prisma.contact.findMany({
    where: { email: { in: emails } },
    select: { email: true, companyName: true },
  });
  const companyByEmail = new Map(contacts.map((c) => [c.email, c.companyName]));

  const sendable: MarketingRecipient[] = [];
  const skippedLogs: { toEmail: string }[] = [];

  for (const r of recipients) {
    if (suppressedSet.has(r.email) || unsubscribedSet.has(r.email)) {
      skippedLogs.push({ toEmail: r.email });
    } else {
      sendable.push(r);
    }
  }

  if (skippedLogs.length > 0) {
    await prisma.emailLog.createMany({
      data: skippedLogs.map((s) => ({
        toEmail: s.toEmail,
        subject,
        status: "skipped",
        sentBy: sentBy || "",
      })),
    });
    result.skipped = skippedLogs.length;
  }

  if (sendable.length === 0) return result;

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping marketing email send");
    await prisma.emailLog.createMany({
      data: sendable.map((r) => ({
        toEmail: r.email,
        subject,
        status: "failed",
        sentBy: sentBy || "",
      })),
    });
    result.failed = sendable.length;
    return result;
  }

  const footer = await getFooterSettingsShared();
  const footerHtml = buildFooterHtml(footer);

  const messages = sendable.map((r) => {
    const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(r.email)}`;
    const values: MergeTagValues = {
      name: r.name,
      company: r.company ?? companyByEmail.get(r.email),
      email: r.email,
    };
    const rendered = renderForRecipient(subject, html, values, defaultName);
    const fullHtml = `
      ${rendered.html}
      ${footerHtml}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 12px;">
        配信停止をご希望の場合は<a href="${unsubscribeUrl}" style="color: #9ca3af;">こちら</a>から手続きできます。
      </p>
    `;
    return {
      from: `${MARKETING_FROM_NAME} <${MARKETING_FROM_EMAIL}>`,
      to: [r.email],
      subject: rendered.subject,
      html: fullHtml,
      // Each batch element needs its own Reply-To; batch.send() does not
      // inherit a top-level value. See comment on getFooterSettingsShared.
      ...(footer.contactEmail ? { replyTo: footer.contactEmail } : {}),
    };
  });

  const BATCH_SIZE = 100;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const batchRecipients = sendable.slice(i, i + BATCH_SIZE);

    try {
      const { data, error } = await getResend().batch.send(batch);
      if (error) {
        console.error("Marketing email batch send error:", error);
        await prisma.emailLog.createMany({
          data: batchRecipients.map((r) => ({
            toEmail: r.email,
            subject,
            status: "failed",
            sentBy: sentBy || "",
          })),
        });
        result.failed += batchRecipients.length;
        continue;
      }

      // batch.send() resolves data.data in the same order as the `batch`
      // array we sent, and batchRecipients is sliced from `sendable` using
      // the same indices used to build `messages`/`batch` above — so
      // sentIds[idx] is guaranteed to be the id for batchRecipients[idx].
      // createMany accepts a distinct data object per row, so each row can
      // carry its own messageId without any extra round-trip or per-row
      // insert (still a single bulk INSERT for the whole batch).
      const sentIds = data?.data ?? [];
      await prisma.emailLog.createMany({
        data: batchRecipients.map((r, idx) => ({
          toEmail: r.email,
          subject,
          status: sentIds[idx] ? "sent" : "failed",
          sentBy: sentBy || "",
          messageId: sentIds[idx]?.id ?? "",
        })),
      });
      result.sent += sentIds.length;
      result.failed += batchRecipients.length - sentIds.length;
    } catch (error) {
      console.error("Marketing email batch send exception:", error);
      await prisma.emailLog.createMany({
        data: batchRecipients.map((r) => ({
          toEmail: r.email,
          subject,
          status: "failed",
          sentBy: sentBy || "",
        })),
      });
      result.failed += batchRecipients.length;
    }
  }

  return result;
}

// Sample data used for previewing/test-sending marketing emails
const PREVIEW_SAMPLE: MergeTagValues = {
  name: "サンプル 太郎",
  company: "サンプル株式会社",
  email: "sample@example.com",
};

interface RenderMarketingPreviewParams {
  subject: string;
  html: string;
  defaultName?: string;
}

// Render subject/html with sample data, footer, and a dummy unsubscribe link.
// Does not send anything.
export async function renderMarketingPreview({
  subject,
  html,
  defaultName,
}: RenderMarketingPreviewParams): Promise<{ subject: string; html: string }> {
  const footer = await getEmailFooterSettings();
  const footerHtml = buildFooterHtml(footer);
  const rendered = renderForRecipient(subject, html, PREVIEW_SAMPLE, defaultName);
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(PREVIEW_SAMPLE.email!)}`;
  const fullHtml = `
    ${rendered.html}
    ${footerHtml}
    <p style="color: #9ca3af; font-size: 12px; margin-top: 12px;">
      配信停止をご希望の場合は<a href="${unsubscribeUrl}" style="color: #9ca3af;">こちら</a>から手続きできます。
    </p>
  `;
  return { subject: rendered.subject, html: fullHtml };
}

interface SendTestEmailParams {
  to: string;
  subject: string;
  html: string;
  defaultName?: string;
  sentBy?: string;
}

// Send a single test email to `to` using sample merge-tag data.
// Bypasses suppression/subscription checks since this is not sent to a real contact.
export async function sendTestEmail({
  to,
  subject,
  html,
  defaultName,
  sentBy,
}: SendTestEmailParams): Promise<{ success: boolean }> {
  const rendered = renderForRecipient(subject, html, PREVIEW_SAMPLE, defaultName);
  const testSubject = `[テスト送信] ${rendered.subject}`;

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping test email send");
    await prisma.emailLog.create({
      data: {
        toEmail: to,
        subject: testSubject,
        status: "test",
        sentBy: sentBy || "",
      },
    });
    return { success: false };
  }

  const footer = await getFooterSettingsShared();
  const footerHtml = buildFooterHtml(footer);
  const unsubscribeUrl = `${APP_URL}/unsubscribe?email=${encodeURIComponent(to)}`;
  const fullHtml = `
    ${rendered.html}
    ${footerHtml}
    <p style="color: #9ca3af; font-size: 12px; margin-top: 12px;">
      配信停止をご希望の場合は<a href="${unsubscribeUrl}" style="color: #9ca3af;">こちら</a>から手続きできます。
    </p>
  `;

  try {
    const result = await getResend().emails.send({
      from: `${MARKETING_FROM_NAME} <${MARKETING_FROM_EMAIL}>`,
      to: [to],
      subject: testSubject,
      html: fullHtml,
      ...(footer.contactEmail ? { replyTo: footer.contactEmail } : {}),
    });
    await prisma.emailLog.create({
      data: {
        toEmail: to,
        subject: testSubject,
        status: "test",
        sentBy: sentBy || "",
        messageId: result.data?.id ?? "",
      },
    });
    return { success: !!result };
  } catch (error) {
    console.error("Test email send error:", error);
    await prisma.emailLog.create({
      data: {
        toEmail: to,
        subject: testSubject,
        status: "test",
        sentBy: sentBy || "",
      },
    });
    return { success: false };
  }
}
