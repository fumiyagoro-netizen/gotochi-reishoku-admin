import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAwardId } from "@/lib/award";
import { getRoleFromRequest, getPermissions } from "@/lib/role";

const RESULT_LIMIT = 20;

// GET: search entries for the 対象エントリー picker on the invoice create/
// edit form (src/components/invoice-form.tsx). Deliberately its own
// endpoint under /api/invoices rather than a general-purpose /api/entries
// list — there's no existing list endpoint for entries (src/app/entries/
// page.tsx queries Prisma directly as a Server Component), so this is a
// narrow, invoice-feature-scoped read gated by canManageInvoices rather
// than a new general entries API. Both roles that carry canManageInvoices
// (admin/representative) already have canSeePrivateInfo: true, so exposing
// company/contact fields here doesn't loosen anything beyond what those
// roles can already see on /entries.
export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") || "").trim();
  const awardId = await resolveAwardId(params.get("year") || undefined);

  try {
    const entries = await prisma.entry.findMany({
      where: {
        AND: [
          awardId ? { awardId } : {},
          q
            ? {
                OR: [
                  { companyName: { contains: q } },
                  { contactLastName: { contains: q } },
                  { contactFirstName: { contains: q } },
                  { email: { contains: q } },
                  { answerNo: { contains: q } },
                ],
              }
            : {},
        ],
      },
      orderBy: { answeredAt: "desc" },
      take: RESULT_LIMIT,
      select: {
        id: true,
        answerNo: true,
        companyName: true,
        contactLastName: true,
        contactFirstName: true,
        email: true,
        award: { select: { year: true } },
      },
    });

    return NextResponse.json({ success: true, entries });
  } catch (error) {
    console.error("Invoice entry search error:", error);
    return NextResponse.json({ success: false, message: "検索に失敗しました" }, { status: 500 });
  }
}
