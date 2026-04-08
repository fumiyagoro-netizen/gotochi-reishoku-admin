import { prisma } from "@/lib/prisma";
import { EntryForm } from "@/components/entry-form";

// Revalidate every 30 seconds (entry period check doesn't need to be real-time)
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

export default async function EntryPage() {
  const award = await prisma.award.findFirst({
    where: { isActive: true },
    select: { id: true, year: true, name: true, entryStartDate: true, entryEndDate: true },
  });

  if (!award) {
    return <ClosedMessage title="現在エントリーを受け付けておりません" message="次回の募集開始までお待ちください。" />;
  }

  const now = new Date();

  if (award.entryStartDate && now < new Date(award.entryStartDate)) {
    const startStr = new Date(award.entryStartDate).toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric",
    });
    return <ClosedMessage title="エントリー受付はまだ開始されていません" message={`受付開始日: ${startStr}`} />;
  }

  if (award.entryEndDate && now > new Date(award.entryEndDate)) {
    return <ClosedMessage title="エントリー受付は終了しました" message="たくさんのご応募ありがとうございました。" />;
  }

  // Show deadline if set
  const deadlineStr = award.entryEndDate
    ? new Date(award.entryEndDate).toLocaleDateString("ja-JP", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{award.name}</h1>
        <p className="text-gray-600 mt-2">エントリーフォーム</p>
        {deadlineStr && (
          <p className="text-sm text-orange-600 mt-1">
            受付締切: {deadlineStr}
          </p>
        )}
      </div>
      <EntryForm awardId={award.id} awardYear={award.year} />
    </div>
  );
}
