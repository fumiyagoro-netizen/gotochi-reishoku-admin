import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { maskEntryPrivateFields } from "@/lib/entry-privacy";
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

  const role = await getCurrentRole();
  const perms = getPermissions(role);

  // viewer has canSeePrivateInfo=false and EntryDetail shows a masked
  // placeholder instead of the applicant's contact name / email / phone,
  // but Server Component props are shipped to the browser verbatim
  // regardless of what the UI renders — so the plaintext must never reach
  // the client component for viewer. Compute the masked display value here
  // and pass that instead. See src/lib/entry-privacy.ts.
  const visibleEntry = perms.canSeePrivateInfo
    ? entry
    : maskEntryPrivateFields(entry);

  return <EntryDetail entry={visibleEntry} />;
}
