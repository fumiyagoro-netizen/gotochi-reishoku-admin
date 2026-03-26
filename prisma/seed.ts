import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseCsv, parseImageUrls, mapCsvRowToEntry } from "../src/lib/csv-parser";

const prisma = new PrismaClient();

async function main() {
  const csvPath =
    process.argv[2] ||
    resolve(process.env.HOME || "~", "Downloads/entries.csv");

  console.log(`Reading CSV from: ${csvPath}`);
  const text = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} rows`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const data = mapCsvRowToEntry(row);
    if (!data.answerNo) {
      skipped++;
      continue;
    }

    const existing = await prisma.entry.findUnique({
      where: { answerNo: data.answerNo },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Find or create the default award (year 2025)
    let award = await prisma.award.findFirst({ orderBy: { year: "desc" } });
    if (!award) {
      award = await prisma.award.create({
        data: { year: 2025, name: "ご当地冷凍食品大賞 2025" },
      });
    }

    const entry = await prisma.entry.create({
      data: { ...data, awardId: award.id },
    });

    const images = parseImageUrls(data.productPhotosRaw);
    if (images.length > 0) {
      await prisma.entryImage.createMany({
        data: images.map((img) => ({
          entryId: entry.id,
          imageUrl: img.url,
          imageType: img.type,
          sortOrder: img.sortOrder,
        })),
      });
    }

    created++;
  }

  console.log(`Done: ${created} created, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
