"use client";

import { useSiteModal, type SiteForm } from "./modal-provider";

/**
 * お問い合わせ・説明会のフォームをその場で開くボタン。
 * どのフォームを出すかは管理画面（バナー・サイト設定）で選ぶ。選んでいなければ何も出さない。
 */
export function FormButton({
  form,
  className,
  children,
}: {
  form: SiteForm | null;
  className: string;
  children: React.ReactNode;
}) {
  const { openForm } = useSiteModal();
  if (!form) return null;
  return (
    <button type="button" className={className} onClick={() => openForm(form)}>
      {children}
    </button>
  );
}
