import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await prisma.entryImage.findUnique({
    where: { id: parseInt(id) },
  });

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    };

    if (download) {
      const ext = contentType.includes("png")
        ? ".png"
        : contentType.includes("jpeg") || contentType.includes("jpg")
        ? ".jpg"
        : contentType.includes("webp")
        ? ".webp"
        : ".jpg";
      headers["Content-Disposition"] = `attachment; filename="image-${id}${ext}"`;
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 }
    );
  }
}
