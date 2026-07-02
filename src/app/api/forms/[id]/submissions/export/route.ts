import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import type { FormField, FormAnswers } from "@/lib/form";
import ExcelJS from "exceljs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = await getRoleFromRequest(request);
    const perms = getPermissions(role);
    if (!perms.canDownload) {
      return NextResponse.json(
        { success: false, message: "ダウンロード権限がありません" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const formId = parseInt(id);

    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form) {
      return NextResponse.json(
        { success: false, message: "フォームが見つかりません" },
        { status: 404 }
      );
    }

    const submissions = await prisma.formSubmission.findMany({
      where: { formId },
      orderBy: { createdAt: "desc" },
    });

    const contactIds = [...new Set(submissions.map((s) => s.contactId).filter((cid): cid is number => cid != null))];
    const contacts = contactIds.length
      ? await prisma.contact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    const fields = (form.fields as unknown as FormField[]) || [];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("回答一覧");

    const columns = [
      { header: "受信日時", key: "createdAt", width: 20 },
      { header: "連絡先", key: "contact", width: 25 },
      ...fields.map((f) => ({ header: f.label, key: f.id, width: 30 })),
    ];
    sheet.columns = columns;

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 10 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EDF5" },
    };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 24;

    for (const submission of submissions) {
      const answers = (submission.answers as unknown as FormAnswers) || {};
      const contact = submission.contactId != null ? contactMap.get(submission.contactId) : null;

      const row: Record<string, string> = {
        createdAt: new Date(submission.createdAt).toLocaleString("ja-JP"),
        contact: contact ? `${contact.email}${contact.name ? ` (${contact.name})` : ""}` : "",
      };

      for (const field of fields) {
        const value = answers[field.id];
        row[field.id] = Array.isArray(value) ? value.join(", ") : (value ?? "");
      }

      sheet.addRow(row);
    }

    const dataRowCount = sheet.rowCount;
    for (let i = 2; i <= dataRowCount; i++) {
      const row = sheet.getRow(i);
      row.alignment = { vertical: "middle", wrapText: true };
      row.font = { size: 10 };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="form_${form.slug}_submissions.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Form export error:", error);
    return NextResponse.json(
      { success: false, message: "エクスポートに失敗しました" },
      { status: 500 }
    );
  }
}
