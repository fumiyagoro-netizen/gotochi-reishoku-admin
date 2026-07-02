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
