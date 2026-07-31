import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { getCachedCurrentUser } from "@/lib/auth";
import { maskEntryPrivateFields } from "@/lib/entry-privacy";
import { EntryDetail } from "@/components/entry-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EntryDetailPage({ params }: Props) {
  const { id } = await params;
  const entryId = parseInt(id);
  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!entry) notFound();

  const role = await getCurrentRole();
  const perms = getPermissions(role);
  // getCachedCurrentUser is React cache()-wrapped (see src/lib/auth.ts) and
  // was already invoked once for this request by RootLayout, so this is not
  // an extra DB round trip. We only need it here for the actor's own userId
  // (to let EntryComments show a delete button on the current user's own
  // comments) — that is the viewer's own identity, not applicant data, so
  // it is not subject to the private-field masking below.
  const currentUser = await getCachedCurrentUser();

  // Comments are visible to every logged-in role, unlike the applicant's
  // private contact info, so no masking is needed here.
  const comments = await prisma.entryComment.findMany({
    where: { entryId },
    orderBy: { createdAt: "desc" },
  });

  // viewer has canSeePrivateInfo=false and EntryDetail shows a masked
  // placeholder instead of the applicant's contact name / email / phone,
  // but Server Component props are shipped to the browser verbatim
  // regardless of what the UI renders — so the plaintext must never reach
  // the client component for viewer. Compute the masked display value here
  // and pass that instead. See src/lib/entry-privacy.ts.
  const visibleEntry = perms.canSeePrivateInfo
    ? entry
    : maskEntryPrivateFields(entry);

  return (
    <EntryDetail
      entry={visibleEntry}
      comments={comments.map((c) => ({
        id: c.id,
        userId: c.userId,
        authorName: c.authorName,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      }))}
      currentUserId={currentUser?.userId}
    />
  );
}
