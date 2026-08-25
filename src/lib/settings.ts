import { prisma } from "./prisma";

export async function getSetting(key: string, fallback: string = ""): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export interface EmailFooterSettings {
  senderName: string;
  orgName: string;
  postalAddress: string;
  contactEmail: string;
  contactTel: string;
}

const FOOTER_DEFAULTS: Record<string, string> = {
  sender_name: "ご当地冷凍食品大賞 事務局",
  org_name: "一般社団法人未来の食卓",
  postal_address: "",
  contact_email: "contact@fta.or.jp",
  contact_tel: "",
};

export async function getEmailFooterSettings(): Promise<EmailFooterSettings> {
  const keys = Object.keys(FOOTER_DEFAULTS);
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    senderName: map.get("sender_name") || FOOTER_DEFAULTS.sender_name,
    orgName: map.get("org_name") || FOOTER_DEFAULTS.org_name,
    postalAddress: map.get("postal_address") ?? FOOTER_DEFAULTS.postal_address,
    contactEmail: map.get("contact_email") || FOOTER_DEFAULTS.contact_email,
    contactTel: map.get("contact_tel") ?? FOOTER_DEFAULTS.contact_tel,
  };
}

export { FOOTER_DEFAULTS };

// 請求書の発行者情報。org_name/postal_address/contact_email など上の
// メールフッター用設定とはキーを完全に分けている（用途が違い、値も異なる
// ため — 例えばフッターの contact_email は問い合わせ窓口で、請求書の
// invoice_issuer_email は請求書上に印字する発行者のE-mailであり、将来
// 別の値になる可能性がある）。振込先はここでは単一のフリーテキスト
// （複数行可）として持たせている — 銀行名/支店名/口座種別/口座番号/
// 名義を個別カラムに分けるほどの利用箇所（PDF印字のみ）がなく、既存の
// フッター設定と同じ「単一の文字列を Setting に1キーとして持つ」形に
// 揃えたほうがシンプルなため。
export interface InvoiceIssuerSettings {
  issuerName: string;
  postalAddress: string;
  email: string;
  registrationNumber: string;
  bankInfo: string;
}

// デフォルト値はユーザー確定済みの実際の発行者情報（既存請求書実物から
// 転記）。管理者が /settings で一度も保存していなくても、この既定値の
// まま正しい請求書が発行できるようにするため — src/lib/settings.ts の
// FOOTER_DEFAULTS.contact_email が同様にハードコードされているのと同じ
// 考え方。
const INVOICE_ISSUER_DEFAULTS: Record<string, string> = {
  invoice_issuer_name: "一般社団法人未来の食卓",
  invoice_issuer_postal_address: "〒142-0042 東京都品川区豊町1-13-7",
  invoice_issuer_email: "contact@fta.or.jp",
  invoice_registration_number: "T7010405017862",
  invoice_bank_info: "みずほ銀行(0001) 浜松町支店(148) 普通 3036112 シヤ)ミライノシヨクタク",
};

export async function getInvoiceIssuerSettings(): Promise<InvoiceIssuerSettings> {
  const keys = Object.keys(INVOICE_ISSUER_DEFAULTS);
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    issuerName: map.get("invoice_issuer_name") || INVOICE_ISSUER_DEFAULTS.invoice_issuer_name,
    postalAddress:
      map.get("invoice_issuer_postal_address") ?? INVOICE_ISSUER_DEFAULTS.invoice_issuer_postal_address,
    email: map.get("invoice_issuer_email") || INVOICE_ISSUER_DEFAULTS.invoice_issuer_email,
    registrationNumber:
      map.get("invoice_registration_number") || INVOICE_ISSUER_DEFAULTS.invoice_registration_number,
    bankInfo: map.get("invoice_bank_info") ?? INVOICE_ISSUER_DEFAULTS.invoice_bank_info,
  };
}

export { INVOICE_ISSUER_DEFAULTS };
