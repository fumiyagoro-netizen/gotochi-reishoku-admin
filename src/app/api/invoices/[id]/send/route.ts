import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { getInvoiceIssuerSettings } from "@/lib/settings";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { toInvoicePdfData } from "@/lib/invoice";
import { sendEmail, normalizeBodyHtml } from "@/lib/email";

// Filenames can't safely contain these characters (Windows-reserved, plus
// characters that would be read as path separators by some mail clients).
// recipientName is free text (company name), so this is defensive — nothing
// in today's data actually contains any of these — rather than a response
// to an observed bad input.
function sanitizeForFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "");
}

// POST /api/invoices/[id]/send — emails the invoice PDF to its recipient
// (or, when `testEmail` is set, to the acting admin for a self-check before
// the real send — see src/app/contacts/page.tsx's SendModal for the same
// test-send-before-real-send pattern this follows).
//
// Deliberately built on sendEmail() (the transactional sender), NOT
// sendMarketingEmail()/sendTestEmail() (the Contact/Entry marketing-segment
// senders in src/lib/email.ts):
//   - An invoice is a document tied to an existing business transaction,
//     not a marketing communication, so it must not carry an unsubscribe
//     link, and must not be blocked by Suppression/Contact.subscribed —
//     sendEmail() does neither (see the file-level comment there), which is
//     exactly the behavior this feature needs.
//   - sendEmail() already records every send (and its Resend message id) to
//     EmailLog, so delivery/bounce status for invoice mail shows up in the
//     existing 配信履歴 screen and Resend webhook flow for free.
//
// Amounts and line items are never taken from the request body — the PDF is
// always rendered from the Invoice + InvoiceLine rows freshly read from the
// DB below, the same as GET /api/invoices/[id]/pdf. Only `to` (recipient
// override), `subject`, and `body` (both editable in the send modal) come
// from the client.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageInvoices) {
      return NextResponse.json({ success: false, message: "送信権限がありません" }, { status: 403 });
    }

    const { id } = await params;
    const invoiceId = parseInt(id);
    const body = await request.json();
    const { to, subject, body: emailBody, testEmail } = body as {
      to?: unknown;
      subject?: unknown;
      body?: unknown;
      testEmail?: unknown;
    };

    const subjectStr = String(subject ?? "").trim();
    const bodyStr = String(emailBody ?? "").trim();
    if (!subjectStr || !bodyStr) {
      return NextResponse.json({ success: false, message: "件名と本文は必須です" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        entry: { select: { email: true } },
      },
    });
    if (!invoice) {
      return NextResponse.json({ success: false, message: "対象の請求書が見つかりません" }, { status: 404 });
    }

    // PDF is generated fresh from the DB row on every send (including test
    // sends), so what's attached always matches what's actually stored —
    // never anything the client could have sent along with this request.
    const issuer = await getInvoiceIssuerSettings();
    const pdfBytes = await generateInvoicePdf(toInvoicePdfData(invoice, issuer));
    const attachmentFilename = `請求書_${sanitizeForFilename(invoice.recipientName)}様_${invoice.invoiceNo}.pdf`;
    const attachments = [{ filename: attachmentFilename, content: Buffer.from(pdfBytes) }];

    const htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; white-space: normal;">
        ${normalizeBodyHtml(bodyStr)}
      </div>
    `;

    const user = await getUserFromRequest(request);

    // Test send: always goes to testEmail, never touches sentAt/sentTo/
    // sentBy on the invoice (this never actually "sends the invoice" to the
    // recipient) — same distinction sendTestEmail() draws for marketing
    // mail. Subject/body are exactly what a real send would use, wrapped
    // with a banner making it unmistakable this isn't the real thing.
    if (typeof testEmail === "string" && testEmail.trim()) {
      const testTo = testEmail.trim();
      if (!testTo.includes("@")) {
        return NextResponse.json(
          { success: false, message: "有効なメールアドレスを入力してください" },
          { status: 400 }
        );
      }

      const testHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px 20px 0;">
          <p style="background: #eef2ff; color: #4338ca; padding: 10px 14px; border-radius: 8px; font-size: 13px;">
            これはテスト送信です。実際の請求書送付ではありません。
          </p>
        </div>
        ${htmlBody}
      `;

      const result = await sendEmail({
        to: testTo,
        subject: `[テスト送信] ${subjectStr}`,
        html: testHtml,
        attachments,
        sentBy: user?.email || "",
      });

      await writeAuditLog({
        userId: user?.userId,
        userEmail: user?.email,
        action: "send_invoice_email_test",
        target: "invoice",
        targetId: String(invoiceId),
        detail: `請求書テスト送信「${invoice.invoiceNo}」宛先: ${testTo}`,
      });

      // sendEmail() doesn't throw when Resend's API itself rejects the send
      // (invalid address, quota, etc.) — it returns a truthy object with
      // `.error` set instead (see node_modules/resend's Response<T> type).
      // `!result` alone would miss that and report success, so both are
      // checked explicitly here — unlike the fire-and-forget marketing/entry
      // notification sends elsewhere in this codebase, this result directly
      // decides what the admin is told about a real money document.
      if (!result || result.error) {
        console.error("Invoice test email send error:", result?.error);
        return NextResponse.json({ success: false, message: "テスト送信に失敗しました" }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: "テスト送信しました" });
    }

    // Real send. Recipient defaults to the linked entry's email but can be
    // overridden from the modal (経理担当者が別アドレスのことがあるため —
    // see the completion instructions this feature was built against).
    const toStr = (typeof to === "string" ? to.trim() : "") || invoice.entry.email;
    if (!toStr || !toStr.includes("@")) {
      return NextResponse.json(
        { success: false, message: "有効な送付先メールアドレスを入力してください" },
        { status: 400 }
      );
    }

    const wasAlreadySent = !!invoice.sentAt;

    // Copy the representatives on the real send so the office has the invoice
    // as it went out. Visible CC rather than BCC, so the customer can see who
    // else is across it and a reply-all reaches them — the office asked for it
    // that way. Read from the users table rather than a configured address, so
    // adding or removing a representative in ユーザー管理 is all it takes.
    // Deactivated accounts are excluded; the test branch above deliberately
    // doesn't copy anyone, since a test is for the sender alone.
    const representatives = await prisma.user.findMany({
      where: { role: "representative", isActive: true },
      select: { email: true },
    });
    const ccList = representatives
      .map((r) => r.email)
      .filter((email) => email && email.toLowerCase() !== toStr.toLowerCase());

    const result = await sendEmail({
      to: toStr,
      subject: subjectStr,
      html: htmlBody,
      attachments,
      cc: ccList,
      sentBy: user?.email || "",
    });

    // See the identical check in the test-send branch above for why both
    // `!result` and `result.error` are checked.
    if (!result || result.error) {
      console.error("Invoice email send error:", result?.error);
      return NextResponse.json({ success: false, message: "送信に失敗しました" }, { status: 500 });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { sentAt: new Date(), sentTo: toStr, sentBy: user?.email || "" },
      select: { sentAt: true, sentTo: true, sentBy: true },
    });

    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "send_invoice_email",
      target: "invoice",
      targetId: String(invoiceId),
      detail: `${wasAlreadySent ? "請求書再送" : "請求書送信"}: ${invoice.invoiceNo} 宛先: ${toStr}${
        ccList.length > 0 ? ` CC: ${ccList.join(", ")}` : ""
      } 件名「${subjectStr}」`,
    });

    return NextResponse.json({
      success: true,
      message: wasAlreadySent ? "再送しました" : "送信しました",
      invoice: updated,
    });
  } catch (error) {
    console.error("Send invoice email error:", error);
    return NextResponse.json(
      { success: false, message: "送信処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
