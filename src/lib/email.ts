import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@gotouchireisyoku.com";
const FROM_NAME = "ご当地冷凍食品大賞 事務局";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return null;
  }

  try {
    const result = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    return result;
  } catch (error) {
    console.error("Email send error:", error);
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
