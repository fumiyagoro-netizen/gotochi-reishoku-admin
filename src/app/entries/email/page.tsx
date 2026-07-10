import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { EntryEmailComposer } from "@/components/entry-email-composer";

export const dynamic = "force-dynamic";

export default async function EntryEmailPage() {
  const role = await getCurrentRole();
  const perms = getPermissions(role);

  // Mass email to applicants is admin-only. Non-admins (including editors)
  // are bounced back to the entries list; the API route enforces this too.
  if (!perms.canSendEmail) {
    redirect("/entries");
  }

  const awards = await prisma.award.findMany({
    orderBy: { year: "desc" },
    select: { id: true, year: true, name: true },
  });

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">応募者へメール配信</h2>
      <EntryEmailComposer awards={awards} />
    </div>
  );
}
