/**
 * フォーム項目の型と、サーバ・クライアントの両方で使う小さな判定関数。
 *
 * src/lib/form.ts から切り出してある。あちらは prisma と email（Resend）を
 * import しているので、"use client" のコンポーネントが値を1つでも import
 * すると、それらがまるごとブラウザ側のバンドルに引き込まれてビルドが壊れる
 * （型だけの import は消えるので問題にならない）。role-shared.ts /
 * prospect-shared.ts と同じ切り分け方。
 */

/**
 * FormField definition shape (stored as JSON in Form.fields):
 * {
 *   id: string,
 *   type: FieldType,
 *   label: string,
 *   required: boolean,
 *   hint?: string,            // ラベルの下に出す補足文（入力項目のみ）
 *   content?: string,         // 表示専用ブロックの中身（下記）
 *   options?: string[],       // radio / checkbox / select のみ
 *   mapTo?: "email" | "name" | "companyName" | "phone",  // Contactへのマッピング（任意）
 * }
 *
 * FormSubmission.answers shape:
 * { [fieldId: string]: string | string[] }
 * - checkbox / file(複数) は string[]、それ以外は string
 * - オプトイン同意は answers["__optin"] に "true" / "false" として格納
 * - 表示専用ブロック (DISPLAY_FIELD_TYPES) は回答を持たないのでキー自体が無い
 */

/** 回答者が入力する項目。answers にキーを持つ。 */
export type InputFieldType =
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

/** 見出し・説明文・画像だけを置くための表示専用ブロック。入力欄ではないので
 *  answers にキーを持たず、必須判定・回答一覧の列・Excel出力のいずれからも
 *  外れる（isDisplayField で判定する）。 */
export type DisplayFieldType = "heading" | "paragraph" | "image";

export type FieldType = InputFieldType | DisplayFieldType;

export const DISPLAY_FIELD_TYPES: readonly DisplayFieldType[] = [
  "heading",
  "paragraph",
  "image",
];

export function isDisplayField(field: { type: FieldType }): boolean {
  return (DISPLAY_FIELD_TYPES as readonly string[]).includes(field.type);
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  /** 入力項目の補足文。ラベルの下に小さく表示する。 */
  hint?: string;
  /** 表示専用ブロックの中身。paragraph は本文、image はアップロード済み画像のURL。
   *  heading は label をそのまま見出しとして使うので content は持たない。 */
  content?: string;
  options?: string[];
  mapTo?: "email" | "name" | "companyName" | "phone";
}

export type FormAnswers = Record<string, string | string[]>;
