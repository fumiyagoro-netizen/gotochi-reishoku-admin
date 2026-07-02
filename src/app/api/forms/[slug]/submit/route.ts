import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleFormSubmission } from "@/lib/form";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const form = await prisma.form.findUnique({ where: { slug } });
    if (!form || form.status !== "published") {
      return NextResponse.json(
        { success: false, message: "このフォームは現在受け付けておりません" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const answers = body.answers || {};

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

    await handleFormSubmission(form, answers, ip);

    return NextResponse.json({
      success: true,
      thankYouMessage: form.thankYouMessage || "送信ありがとうございました。",
    });
  } catch (error) {
    console.error("Form submit error:", error);
    const message = error instanceof Error ? error.message : "送信に失敗しました";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
