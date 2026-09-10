import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentRole, getPermissions } from "@/lib/role";
import { EntryEmailComposer } from "@/components/entry-email-composer";
import { PageContainer, PageHeader } from "@/components/ui/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "応募者へメール配信" };

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
    <PageContainer width="form">
      {/* 戻りリンクは見出しの真上に置く方針なので、composer 側ではなくここで描画する（href・文言は同じ） */}
      <PageHeader
        title="応募者へメール配信"
        backHref="/entries"
        backLabel="エントリー一覧に戻る"
      />
      <EntryEmailComposer awards={awards} />
    </PageContainer>
  );
}
