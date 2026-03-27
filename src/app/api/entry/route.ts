import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEntryConfirmation, sendAdminNotification } from "@/lib/email";

async function generateAnswerNo(awardId: number): Promise<string> {
  const award = await prisma.award.findUnique({ where: { id: awardId } });
  const year = award?.year ?? new Date().getFullYear();
  const prefix = `WEB-${year}-`;

  const lastEntry = await prisma.entry.findFirst({
    where: { answerNo: { startsWith: prefix } },
    orderBy: { answerNo: "desc" },
  });

  let nextNum = 1;
  if (lastEntry) {
    const lastNum = parseInt(lastEntry.answerNo.replace(prefix, ""), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = [
      "awardId", "companyName", "contactLastName", "contactFirstName",
      "email", "tradeShowExhibition", "productName", "productCategory",
      "price", "purchaseLocation", "retailPartnership",
      "bacteriaInspection", "expirationInspection", "manufacturingLicense",
      "entryProductLicense", "hygieneManager",
    ];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, message: `${field} は必須です` },
          { status: 400 }
        );
      }
    }

    if (!body.images || !body.images.some((img: { imageType: string }) => img.imageType === "main")) {
      return NextResponse.json(
        { success: false, message: "メイン画像は必須です" },
        { status: 400 }
      );
    }

    // Check active award and entry period
    const award = await prisma.award.findUnique({
      where: { id: body.awardId },
    });
    if (!award || !award.isActive) {
      return NextResponse.json(
        { success: false, message: "現在エントリーを受け付けておりません" },
        { status: 400 }
      );
    }

    // Check entry period
    const now = new Date();
    if (award.entryStartDate && now < new Date(award.entryStartDate)) {
      return NextResponse.json(
        { success: false, message: "エントリー受付期間前です" },
        { status: 400 }
      );
    }
    if (award.entryEndDate && now > new Date(award.entryEndDate)) {
      return NextResponse.json(
        { success: false, message: "エントリー受付は終了しました" },
        { status: 400 }
      );
    }

    // Generate answer number
    const answerNo = await generateAnswerNo(body.awardId);

    // Get IP address
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || "unknown";

    // Helper: combine "その他" with custom text
    const withOther = (value: string, otherText: string) =>
      value === "その他" && otherText ? `その他: ${otherText}` : value;

    // Create entry with images in a transaction
    const entry = await prisma.$transaction(async (tx) => {
      const newEntry = await tx.entry.create({
        data: {
          awardId: body.awardId,
          answerNo,
          answeredAt: new Date().toISOString(),
          ipAddress,
          companyName: body.companyName,
          department: body.department || "",
          contactLastName: body.contactLastName,
          contactFirstName: body.contactFirstName,
          email: body.email,
          phone: body.phone || "",
          tradeShowExhibition: withOther(body.tradeShowExhibition, body.tradeShowOther),
          prefecture: body.prefecture || "",
          productName: body.productName,
          productCategory: withOther(body.productCategory, body.productCategoryOther),
          price: body.price,
          purchaseLocation: body.purchaseLocation.includes("その他") && body.purchaseLocationOther
            ? body.purchaseLocation.replace("その他", `その他: ${body.purchaseLocationOther}`)
            : body.purchaseLocation,
          referenceUrl: body.referenceUrl || "",
          localAppeal: body.localAppeal || "",
          tasteAppeal: body.tasteAppeal || "",
          packageAppeal: body.packageAppeal || "",
          cookingMethod: body.cookingMethod || "",
          otherAppeal: body.otherAppeal || "",
          retailPartnership: body.retailPartnership,
          bacteriaInspection: withOther(body.bacteriaInspection, body.bacteriaInspectionOther),
          expirationInspection: withOther(body.expirationInspection, body.expirationInspectionOther),
          manufacturingLicense: withOther(body.manufacturingLicense, body.manufacturingLicenseOther),
          entryProductLicense: withOther(body.entryProductLicense, body.entryProductLicenseOther),
          hygieneManager: withOther(body.hygieneManager, body.hygieneManagerOther),
          remarks: body.remarks || "",
        },
      });

      // Create image records
      if (body.images && body.images.length > 0) {
        await tx.entryImage.createMany({
          data: body.images.map(
            (img: { blobUrl: string; imageType: string; sortOrder: number }) => ({
              entryId: newEntry.id,
              imageUrl: img.blobUrl,
              imageType: img.imageType,
              sortOrder: img.sortOrder,
            })
          ),
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "create",
          target: "entry",
          targetId: String(newEntry.id),
          detail: `Webフォームからエントリー: ${body.productName} (${body.companyName}) [${answerNo}]`,
        },
      });

      return newEntry;
    });

    // Send emails (non-blocking)
    const contactName = `${body.contactLastName} ${body.contactFirstName}`;
    const emailPromises: Promise<unknown>[] = [
      sendEntryConfirmation({
        to: body.email,
        answerNo: entry.answerNo,
        companyName: body.companyName,
        productName: body.productName,
        contactName,
        awardName: award.name,
      }),
    ];

    // Send admin notification if notify emails are set
    if (award.notifyEmails) {
      const adminEmails = award.notifyEmails.split(",").map((e: string) => e.trim()).filter(Boolean);
      if (adminEmails.length > 0) {
        emailPromises.push(
          sendAdminNotification({
            to: adminEmails,
            answerNo: entry.answerNo,
            companyName: body.companyName,
            productName: body.productName,
            contactName,
            email: body.email,
            phone: body.phone || "",
            awardName: award.name,
          })
        );
      }
    }

    // Await emails before returning response (required for Vercel serverless)
    await Promise.allSettled(emailPromises);

    return NextResponse.json({
      success: true,
      answerNo: entry.answerNo,
      entryId: entry.id,
    });
  } catch (error) {
    console.error("Entry submission error:", error);
    return NextResponse.json(
      { success: false, message: "エントリーの送信に失敗しました" },
      { status: 500 }
    );
  }
}
