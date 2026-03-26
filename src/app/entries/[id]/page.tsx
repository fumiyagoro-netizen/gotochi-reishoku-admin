import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EntryDetail } from "@/components/entry-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EntryDetailPage({ params }: Props) {
  const { id } = await params;
  const entry = await prisma.entry.findUnique({
    where: { id: parseInt(id) },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!entry) notFound();

  return <EntryDetail entry={entry} />;
}
