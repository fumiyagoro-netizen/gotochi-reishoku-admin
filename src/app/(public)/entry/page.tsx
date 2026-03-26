import { prisma } from "@/lib/prisma";
import { EntryForm } from "@/components/entry-form";

export default async function EntryPage() {
  const award = await prisma.award.findFirst({
    where: { isActive: true },
    select: { id: true, year: true, name: true },
  });

  if (!award) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          現在エントリーを受け付けておりません
        </h1>
        <p className="text-gray-600">
          次回の募集開始までお待ちください。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {award.name}
        </h1>
        <p className="text-gray-600 mt-2">エントリーフォーム</p>
      </div>
      <EntryForm awardId={award.id} awardYear={award.year} />
    </div>
  );
}
