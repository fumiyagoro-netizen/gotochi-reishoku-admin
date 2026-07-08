import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { upsertContact } from "@/lib/contact";

// GET: list contacts with optional search and list filter
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const listId = request.nextUrl.searchParams.get("listId");

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
        listId ? { memberships: { some: { listId: parseInt(listId) } } } : {},
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
    if (!perms.canEdit) {
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

    const user = await getUserFromRequest(request);
    await writeAuditLog({
      userId: user?.userId,
      userEmail: user?.email,
      action: "create",
      target: "contact",
      targetId: String(contact.id),
      detail: `連絡先作成: ${contact.email}`,
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
