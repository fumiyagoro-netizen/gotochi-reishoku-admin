import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await prisma.entryImage.findUnique({
    where: { id: parseInt(id) },
    include: {
      entry: {
        select: {
          prizeLevel: true,
          awardId: true,
          sitePublished: true,
          award: { select: { siteSettings: { select: { winnersPublished: true } } } },
        },
      },
    },
  });

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // This route is in PUBLIC_PATHS (middleware never checks auth for it),
  // because logged-out visitors need it to view the public site and the
  // older /results page. Logged-in staff may view any image (admin screens
  // rely on this for thumbnails/downloads of unpublished, in-review entries).
  //
  // Anonymous visitors may view:
  // - 公開サイトに出している商品の写真（受賞あり・sitePublished・年度の「受賞商品を公開」が ON）
  // - /results が出している、最新の受賞年度の商品のメイン写真（従来のルール）
  // Everything else 404s (not 403) so a third party brute-forcing ids can't
  // tell an unpublished image from a nonexistent one.
  const user = await getUserFromRequest(request);
  if (!user) {
    const onSite =
      image.entry.prizeLevel !== "" &&
      image.entry.sitePublished &&
      !!image.entry.award.siteSettings?.winnersPublished;

    let onResults = false;
    if (!onSite && image.imageType === "main" && image.entry.prizeLevel !== "") {
      const latestAward = await prisma.award.findFirst({
        where: { entries: { some: { prizeLevel: { not: "" } } } },
        orderBy: { year: "desc" },
        select: { id: true },
      });
      onResults = !!latestAward && image.entry.awardId === latestAward.id;
    }

    if (!onSite && !onResults) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const download = request.nextUrl.searchParams.get("download") === "1";

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0",
    };

    // Private Vercel Blob requires authorization token
    if (image.imageUrl.includes("private.blob.vercel-storage.com")) {
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const res = await fetch(image.imageUrl, { headers });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = await res.arrayBuffer();

    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    if (download) {
      const ext = contentType.includes("png")
        ? ".png"
        : contentType.includes("jpeg") || contentType.includes("jpg")
        ? ".jpg"
        : contentType.includes("webp")
        ? ".webp"
        : ".jpg";
      resHeaders["Content-Disposition"] = `attachment; filename="image-${id}${ext}"`;
    }

    return new NextResponse(buffer, { status: 200, headers: resHeaders });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 }
    );
  }
}
