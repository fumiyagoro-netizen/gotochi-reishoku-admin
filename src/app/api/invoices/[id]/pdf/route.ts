import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRoleFromRequest, getPermissions } from "@/lib/role";
import { getInvoiceIssuerSettings } from "@/lib/settings";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

// GET /api/invoices/[id]/pdf — renders the invoice as a real (text, not
// screenshot) Japanese PDF. See src/lib/invoice-pdf.ts for how the font is
// embedded and why. Defaults to an inline Content-Disposition so it can be
// opened as a preview (e.g. in a new tab / <iframe>); ?download=1 switches
// to attachment for an explicit download.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getRoleFromRequest(request);
  const perms = getPermissions(role);
  if (!perms.canManageInvoices) {
    return NextResponse.json({ success: false, message: "閲覧権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const invoiceId = parseInt(id);

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) {
      return NextResponse.json({ success: false, message: "対象の請求書が見つかりません" }, { status: 404 });
    }

    const issuer = await getInvoiceIssuerSettings();

    const pdfBytes = await generateInvoicePdf({
      invoiceNo: invoice.invoiceNo,
      recipientName: invoice.recipientName,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      lines: invoice.lines.map((l) => ({
        date: l.date,
        name: l.name,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        amount: l.amount,
      })),
      issuer,
    });

    const download = request.nextUrl.searchParams.get("download");
    const disposition = download ? "attachment" : "inline";
    const asciiFallback = `invoice_${invoice.invoiceNo}.pdf`;
    const filename = `請求書_${invoice.invoiceNo}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("Invoice PDF generation error:", error);
    return NextResponse.json({ success: false, message: "PDFの生成に失敗しました" }, { status: 500 });
  }
}
