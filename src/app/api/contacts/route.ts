import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { upsertContact, addToList } from "@/lib/contact";

// GET: list contacts with optional search and list filter
export async function GET(request: NextRequest) {
  // Contacts are personal data (name/email/phone). canManageContacts gates
  // access to the contacts feature itself (editor must not reach it at
  // all); canSeePrivateInfo is kept as the existing operation-level check
  // (viewers — "閲覧のみ（個人情報は非表示）" — must not read private data).
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageContacts || !perms.canSeePrivateInfo) {
    return NextResponse.json(
      { success: false, message: "閲覧権限がありません" },
      { status: 403 }
    );
  }

  const q = request.nextUrl.searchParams.get("q") || "";
  // Supports repeated ?listId=1&listId=2 as well as the single-value form.
  // Matches contacts in ANY of the given lists (Contact-level dedupe via `some`).
  const listIds = request.nextUrl.searchParams
    .getAll("listId")
    .map((id) => parseInt(id, 10))
    .filter((id) => !Number.isNaN(id));

  try {
    const where = {
      AND: [
        q
          ? {
              OR: [
                { email: { contains: q } },
                { name: { contains: q } },
                { companyName: { contains: q } },
              ],
            }
          : {},
        listIds.length > 0 ? { memberships: { some: { listId: { in: listIds } } } } : {},
      ],
    };

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        memberships: { include: { list: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("Contacts GET error:", error);
    return NextResponse.json(
      { success: false, message: "連絡先の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: create a new contact
export async function POST(request: NextRequest) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canManageContacts || !perms.canEdit) {
      return NextResponse.json(
        { success: false, message: "編集権限がありません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body.email) {
      return NextResponse.json(
        { success: false, message: "メールアドレスは必須です" },
        { status: 400 }
      );
    }

    const contact = await upsertContact({
      email: body.email,
      name: body.name,
      companyName: body.companyName,
      phone: body.phone,
      source: "manual",
      note: body.note,
    });

    // 指定されたリストへ追加（既存の所属には影響しない = 加算のみ）
    const listIds = Array.isArray(body.listIds)
      ? body.listIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n))
      : [];

    let listNames: string[] = [];
    if (listIds.length > 0) {
      const targetLists = await prisma.contactList.findMany({
        where: { id: { in: listIds } },
        select: { name: true },
      });
      listNames = targetLists.map((l) => l.name);
      for (const listId of listIds) {
        await addToList(contact.id, listId);
      }
    }

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "contact",
      targetId: String(contact.id),
      detail: `連絡先作成: ${contact.email}${listNames.length > 0 ? ` / リスト: ${listNames.join(", ")}` : ""}`,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error("Create contact error:", error);
    return NextResponse.json(
      { success: false, message: "連絡先の作成に失敗しました" },
      { status: 500 }
    );
  }
}
