import { prisma } from "@/lib/prisma";
import { PublicForm } from "@/components/public-form";
import type { FormField } from "@/lib/form";

export const revalidate = 30;

function ClosedMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const form = await prisma.form.findUnique({ where: { slug } });

  if (!form) {
    return <ClosedMessage title="フォームが見つかりません" message="URLをご確認ください。" />;
  }

  if (form.status !== "published") {
    return <ClosedMessage title="受付を終了しました" message="このフォームは現在受け付けておりません。" />;
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
        {form.description && <p className="text-gray-600 mt-2 whitespace-pre-wrap">{form.description}</p>}
      </div>
      <PublicForm
        slug={form.slug}
        fields={(form.fields as unknown as FormField[]) || []}
        requireOptIn={form.requireOptIn}
        thankYouMessage={form.thankYouMessage || "送信ありがとうございました。"}
      />
    </div>
  );
}
