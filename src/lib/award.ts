import { prisma } from "./prisma";

export async function resolveAwardId(yearParam?: string): Promise<number | null> {
  if (yearParam) {
    const award = await prisma.award.findUnique({
      where: { year: parseInt(yearParam) },
    });
    return award?.id ?? null;
  }
  // Default to the most recent award
  const latest = await prisma.award.findFirst({
    orderBy: { year: "desc" },
  });
  return latest?.id ?? null;
}

export async function resolveAwardYear(yearParam?: string): Promise<number | null> {
  if (yearParam) return parseInt(yearParam);
  const latest = await prisma.award.findFirst({
    orderBy: { year: "desc" },
  });
  return latest?.year ?? null;
}
