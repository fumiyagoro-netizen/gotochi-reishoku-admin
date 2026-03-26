/**
 * Upload all images from public/uploads/ to Vercel Blob
 * and update DB image URLs
 */
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const uploadsDir = path.join(process.cwd(), "public/uploads");
  const files = fs.readdirSync(uploadsDir).filter(f =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
  );

  console.log(`Found ${files.length} images to upload`);

  // Get all images from DB
  const dbImages = await prisma.entryImage.findMany();
  const urlToId = new Map<string, number[]>();
  for (const img of dbImages) {
    const existing = urlToId.get(img.imageUrl) || [];
    existing.push(img.id);
    urlToId.set(img.imageUrl, existing);
  }

  let uploaded = 0;
  let updated = 0;

  for (const file of files) {
    const localPath = `/uploads/${file}`;
    const filePath = path.join(uploadsDir, file);
    const fileBuffer = fs.readFileSync(filePath);

    try {
      const blob = await put(`uploads/${file}`, fileBuffer, {
        access: "private",
        addRandomSuffix: false,
      });

      // Update DB records that reference this local path
      const ids = urlToId.get(localPath);
      if (ids && ids.length > 0) {
        await prisma.entryImage.updateMany({
          where: { id: { in: ids } },
          data: { imageUrl: blob.url },
        });
        updated += ids.length;
      }

      uploaded++;
      if (uploaded % 20 === 0) {
        console.log(`  ${uploaded}/${files.length} uploaded...`);
      }
    } catch (error) {
      console.error(`Failed to upload ${file}:`, error);
    }
  }

  console.log(`Done: ${uploaded} files uploaded, ${updated} DB records updated`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
