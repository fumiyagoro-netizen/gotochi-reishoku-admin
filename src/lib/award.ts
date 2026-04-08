import { cache } from "react";
import { prisma } from "./prisma";

interface ResolvedAward {
  id: number | null;
  year: number | null;
}

// Cache per request — resolveAwardId + resolveAwardYear share a single DB call
const resolveAward = cache(async (yearParam?: string): Promise<ResolvedAward> => {
  if (yearParam) {
    const y = parseInt(yearParam);
    const award = await prisma.award.findUnique({
      where: { year: y },
      select: { id: true, year: true },
    });
    return { id: award?.id ?? null, year: award?.year ?? null };
  }
  const latest = await prisma.award.findFirst({
    orderBy: { year: "desc" },
    select: { id: true, year: true },
  });
  return { id: latest?.id ?? null, year: latest?.year ?? null };
});

export async function resolveAwardId(yearParam?: string): Promise<number | null> {
  return (await resolveAward(yearParam)).id;
}

export async function resolveAwardYear(yearParam?: string): Promise<number | null> {
  return (await resolveAward(yearParam)).year;
}
