import { prisma } from "./prisma";
import { upsertContact } from "./contact";
import { sendFormAutoReply } from "./email";

/**
 * FormField definition shape (stored as JSON in Form.fields):
 * {
 *   id: string,
 *   type: "text" | "textarea" | "email" | "tel" | "number" | "radio" | "checkbox" | "select" | "date" | "file",
 *   label: string,
 *   required: boolean,
 *   options?: string[],       // radio / checkbox / select のみ
 *   mapTo?: "email" | "name" | "companyName" | "phone",  // Contactへのマッピング（任意）
 * }
 *
 * FormSubmission.answers shape:
 * { [fieldId: string]: string | string[] }
 * - checkbox / file(複数) は string[]、それ以外は string
 * - オプトイン同意は answers["__optin"] に "true" / "false" として格納
 */

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "number"
  | "radio"
  | "checkbox"
  | "select"
  | "date"
  | "file";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options?: string[];
  mapTo?: "email" | "name" | "companyName" | "phone";
}

export type FormAnswers = Record<string, string | string[]>;

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSlug(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return out;
}

/** Generate a URL-safe unique slug. Retries on collision. */
export async function generateSlug(title?: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = randomSlug(8);
    const existing = await prisma.form.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback
  return `${randomSlug(8)}${Date.now().toString(36)}`;
}

export interface FormLike {
  id: number;
  fields: unknown;
  targetListId: number | null;
  requireOptIn: boolean;
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyBody: string;
}

/** Validate required fields and normalize answers against the field definitions. */
function validateAnswers(fields: FormField[], answers: FormAnswers): string | null {
  for (const field of fields) {
    if (!field.required) continue;
    const value = answers[field.id];
    if (field.type === "checkbox") {
      if (!Array.isArray(value) || value.length === 0) {
        return `${field.label}は必須です`;
      }
    } else if (Array.isArray(value)) {
      if (value.length === 0 || !value[0]) {
        return `${field.label}は必須です`;
      }
    } else if (!value || !String(value).trim()) {
      return `${field.label}は必須です`;
    }
  }
  return null;
}

async function addToList(contactId: number, listId: number) {
  await prisma.contactListMembership.upsert({
    where: { contactId_listId: { contactId, listId } },
    update: {},
    create: { contactId, listId },
  });
}

/**
 * Handle a public form submission: validate, persist, and (optionally) upsert/opt-in a Contact.
 * Throws Error with a Japanese message on validation failure.
 */
export async function handleFormSubmission(
  form: FormLike,
  answers: FormAnswers,
  ip: string
) {
  const fields = (form.fields as unknown as FormField[]) || [];

  const validationError = validateAnswers(fields, answers);
  if (validationError) {
    throw new Error(validationError);
  }

  // Resolve Contact mapping, if any field maps to email
  const emailField = fields.find((f) => f.mapTo === "email");
  let contactId: number | undefined;

  // Auto-reply destination/merge-tag values, resolved below alongside the
  // Contact mapping (same mapTo:"email"/"name"/"companyName" fields).
  let autoReplyTo: string | undefined;
  let autoReplyName: string | undefined;
  let autoReplyCompany: string | undefined;

  if (emailField) {
    const rawEmail = answers[emailField.id];
    const email = (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail || "").trim();

    if (email) {
      const nameField = fields.find((f) => f.mapTo === "name");
      const companyField = fields.find((f) => f.mapTo === "companyName");
      const phoneField = fields.find((f) => f.mapTo === "phone");

      const pick = (f?: FormField) => {
        if (!f) return undefined;
        const v = answers[f.id];
        return Array.isArray(v) ? v.join(", ") : v;
      };

      autoReplyTo = email;
      autoReplyName = pick(nameField);
      autoReplyCompany = pick(companyField);

      const contact = await upsertContact({
        email,
        name: pick(nameField),
        companyName: pick(companyField),
        phone: pick(phoneField),
        source: "form",
        // Form-sourced contacts start unsubscribed; only explicit opt-in below
        // (requireOptIn + consent) marks them subscribed. (特定電子メール法)
        subscribed: false,
      });
      contactId = contact.id;

      // Opt-in handling (特定電子メール法対応: 明示同意がない限り配信可にしない)
      if (form.requireOptIn) {
        const optInRaw = answers["__optin"];
        const optedIn = optInRaw === "true" || (Array.isArray(optInRaw) && optInRaw[0] === "true");

        if (optedIn) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { subscribed: true, optInAt: new Date() },
          });
          if (form.targetListId) {
            await addToList(contact.id, form.targetListId);
          }
        }
      }
      // requireOptIn が false の場合は subscribed / リスト所属を変更しない
    }
  }

  const submission = await prisma.formSubmission.create({
    data: {
      formId: form.id,
      answers: answers as never,
      contactId,
      ipAddress: ip,
    },
  });

  // Auto-reply to the respondent (best-effort: failures must never fail the
  // submission itself, since the answer is already persisted above).
  if (form.autoReplyEnabled && autoReplyTo) {
    try {
      await sendFormAutoReply({
        to: autoReplyTo,
        subject: form.autoReplySubject,
        body: form.autoReplyBody,
        name: autoReplyName,
        company: autoReplyCompany,
      });
    } catch (error) {
      console.error("Form auto-reply send error:", error);
    }
  }

  return submission;
}
