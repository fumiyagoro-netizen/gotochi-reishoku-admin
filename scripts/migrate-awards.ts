import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { resolve } from "path";

const DB_PATH = resolve(__dirname, "../prisma/dev.db");

async function main() {
  // Use raw SQLite for schema changes
  const db = new Database(DB_PATH);

  console.log("Creating Award table...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS "Award" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "year" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "Award_year_key" ON "Award"("year");`);

  // Insert 2025 award
  const existing = db.prepare(`SELECT id FROM "Award" WHERE year = 2025`).get() as { id: number } | undefined;
  let awardId: number;
  if (existing) {
    awardId = existing.id;
    console.log("2025 award already exists (id=" + awardId + ")");
  } else {
    const result = db.prepare(`INSERT INTO "Award" (year, name, isActive) VALUES (2025, 'ご当地冷凍食品大賞 2025', 1)`).run();
    awardId = Number(result.lastInsertRowid);
    console.log("Created 2025 award (id=" + awardId + ")");
  }

  // Add awardId column to Entry if it doesn't exist
  const columns = db.prepare(`PRAGMA table_info("Entry")`).all() as { name: string }[];
  const hasAwardId = columns.some((c) => c.name === "awardId");

  if (!hasAwardId) {
    console.log("Adding awardId column to Entry...");
    db.exec(`ALTER TABLE "Entry" ADD COLUMN "awardId" INTEGER NOT NULL DEFAULT ${awardId}`);
    console.log(`Set all existing entries to awardId=${awardId}`);
  } else {
    console.log("awardId column already exists, updating entries without awardId...");
    db.prepare(`UPDATE "Entry" SET "awardId" = ? WHERE "awardId" = 0 OR "awardId" IS NULL`).run(awardId);
  }

  db.close();

  // Verify with Prisma
  const prisma = new PrismaClient();
  const awards = await prisma.award.findMany();
  const entryCount = await prisma.entry.count({ where: { awardId } });
  console.log(`\nVerification:`);
  console.log(`  Awards: ${awards.map((a) => `${a.year} (${a.name})`).join(", ")}`);
  console.log(`  Entries in 2025: ${entryCount}`);
  await prisma.$disconnect();
}

main().catch(console.error);
