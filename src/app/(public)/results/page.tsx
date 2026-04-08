import { prisma } from "@/lib/prisma";

// Revalidate every 60 seconds instead of on every request
export const revalidate = 60;

const PRIZE_ORDER: Record<string, number> = {
  "最高金賞": 1,
  "金賞": 2,
  "銀賞": 3,
  "銅賞": 4,
};

const PRIZE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "最高金賞": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300" },
  "金賞": { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-300" },
  "銀賞": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300" },
  "銅賞": { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-300" },
};

export default async function ResultsPage() {
  // Get the latest award that has prize winners
  const award = await prisma.award.findFirst({
    where: {
      entries: { some: { prizeLevel: { not: "" } } },
    },
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true },
  });

  if (!award) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">受賞結果はまだ発表されていません</h1>
        <p className="text-gray-600">結果発表までお待ちください。</p>
      </div>
    );
  }

  const entries = await prisma.entry.findMany({
    where: { awardId: award.id, prizeLevel: { not: "" } },
    include: {
      images: { where: { imageType: "main" }, take: 1 },
    },
    orderBy: { productName: "asc" },
  });

  // Group by prize level and sort
  const grouped = entries.reduce((acc, entry) => {
    if (!acc[entry.prizeLevel]) acc[entry.prizeLevel] = [];
    acc[entry.prizeLevel].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);

  const sortedPrizes = Object.keys(grouped).sort(
    (a, b) => (PRIZE_ORDER[a] ?? 99) - (PRIZE_ORDER[b] ?? 99)
  );

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">{award.name}</h1>
        <p className="text-lg text-gray-600 mt-2">受賞結果</p>
        <p className="text-sm text-gray-400 mt-1">受賞商品 {entries.length}品</p>
      </div>

      {sortedPrizes.map((prize) => {
        const colors = PRIZE_COLORS[prize] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300" };
        const items = grouped[prize];

        return (
          <div key={prize} className="mb-10">
            <div className={`text-center mb-6 py-3 rounded-xl ${colors.bg} border ${colors.border}`}>
              <h2 className={`text-xl font-bold ${colors.text}`}>
                {prize === "最高金賞" && "🏆 "}
                {prize === "金賞" && "🥇 "}
                {prize === "銀賞" && "🥈 "}
                {prize === "銅賞" && "🥉 "}
                {prize}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{items.length}品</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((entry) => {
                const mainImage = entry.images[0];
                return (
                  <div
                    key={entry.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {mainImage ? (
                      <div className="aspect-square bg-gray-100">
                        <img
                          src={`/api/images/${mainImage.id}`}
                          alt={entry.productName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-4xl">📦</span>
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">
                        {entry.productName}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{entry.companyName}</p>
                      {entry.productCategory && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {entry.productCategory}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
