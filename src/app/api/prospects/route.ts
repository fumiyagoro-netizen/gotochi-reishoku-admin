import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  PROSPECT_CONTACT_STATUSES,
  isProspectContactStatus,
  isProspectConfidenceLevel,
} from "@/lib/prospect-shared";

const PAGE_SIZE = 50;

// GET: list prospects with optional search/filters + pagination
export async function GET(request: NextRequest) {
  // 追客リスト is a standalone feature (no relation to Contact/Entry) gated
  // by canManageProspects alone — see the comment above PERMISSIONS in
  // src/lib/role-shared.ts for why this isn't also paired with canEdit /
  // canSeePrivateInfo the way contacts/forms are.
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageProspects) {
    return NextResponse.json(
      { success: false, message: "閲覧権限がありません" },
      { status: 403 }
    );
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q") || "";
  const contactStatus = params.get("contactStatus") || "";
  const prefecture = params.get("prefecture") || "";
  const confidence = params.get("confidence") || "";
  const assignee = params.get("assignee") || "";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);

  try {
    const where = {
      AND: [
        q
          ? {
              OR: [
                { makerName: { contains: q } },
                { productName: { contains: q } },
              ],
            }
          : {},
        contactStatus ? { contactStatus } : {},
        prefecture ? { prefecture } : {},
        confidence ? { confidence } : {},
        assignee ? { assignee } : {},
      ],
    };

    // 県名・担当者はフリーテキスト由来の値なので、絞り込みセレクトの選択肢は
    // 実データから動的に作る（現在の絞り込み条件には影響されず、常に全件から集計）。
    const [prospects, total, prefectureRows, assigneeRows] = await Promise.all([
      prisma.prospect.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.prospect.count({ where }),
      prisma.prospect.findMany({
        where: { prefecture: { not: "" } },
        distinct: ["prefecture"],
        select: { prefecture: true },
        orderBy: { prefecture: "asc" },
      }),
      prisma.prospect.findMany({
        where: { assignee: { not: "" } },
        distinct: ["assignee"],
        select: { assignee: true },
        orderBy: { assignee: "asc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      prospects,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      filterOptions: {
        prefectures: prefectureRows.map((r) => r.prefecture),
        assignees: assigneeRows.map((r) => r.assignee),
      },
    });
  } catch (error) {
    console.error("Prospects GET error:", error);
    return NextResponse.json(
      { success: false, message: "追客リストの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: create a new prospect (manual single-row add)
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageProspects) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const makerName = String(body.makerName ?? "").trim();
    if (!makerName) {
      return NextResponse.json(
        { success: false, message: "メーカー名は必須です" },
        { status: 400 }
      );
    }

    if (body.contactStatus !== undefined && !isProspectContactStatus(body.contactStatus)) {
      return NextResponse.json(
        { success: false, message: "コンタクト状況の値が不正です" },
        { status: 400 }
      );
    }
    if (
      body.confidence !== undefined &&
      body.confidence !== "" &&
      !isProspectConfidenceLevel(body.confidence)
    ) {
      return NextResponse.json(
        { success: false, message: "確度の値が不正です" },
        { status: 400 }
      );
    }

    const prospect = await prisma.prospect.create({
      data: {
        makerName,
        prefecture: String(body.prefecture ?? ""),
        productName: String(body.productName ?? ""),
        tempZone: String(body.tempZone ?? ""),
        confidence: String(body.confidence ?? ""),
        supplement: String(body.supplement ?? ""),
        url: String(body.url ?? ""),
        contactStatus: body.contactStatus || PROSPECT_CONTACT_STATUSES[0],
        assignee: String(body.assignee ?? ""),
        email: String(body.email ?? ""),
        memo: String(body.memo ?? ""),
      },
    });

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "prospect",
      targetId: String(prospect.id),
      detail: `追客リスト作成: ${prospect.makerName}`,
    });

    return NextResponse.json({ success: true, prospect });
  } catch (error) {
    console.error("Create prospect error:", error);
    return NextResponse.json(
      { success: false, message: "追客リストの作成に失敗しました" },
      { status: 500 }
    );
  }
}
