import { prisma } from "./prisma";

/** 企画の対象年度の選択肢（新しい年度から）。受賞商品の数も添える */
export async function loadAwardChoices(): Promise<{ id: number; year: number; winners: number }[]> {
  const [awards, counts] = await Promise.all([
    prisma.award.findMany({ orderBy: { year: "desc" }, select: { id: true, year: true } }),
    prisma.entry.groupBy({ by: ["awardId"], where: { prizeLevel: { not: "" } }, _count: { id: true } }),
  ]);
  const countOf = new Map(counts.map((c) => [c.awardId, c._count.id]));
  return awards.map((a) => ({ ...a, winners: countOf.get(a.id) ?? 0 }));
}
