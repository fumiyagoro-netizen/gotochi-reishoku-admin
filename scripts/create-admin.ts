/**
 * 初期管理者ユーザーを作成するスクリプト
 * Usage: npx tsx scripts/create-admin.ts <email> <password> <name>
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || "管理者";

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password> [name]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists. Updating to admin...`);
    await prisma.user.update({
      where: { email },
      data: { role: "admin", password: await bcrypt.hash(password, 12) },
    });
    console.log("Updated successfully.");
  } else {
    await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 12),
        name,
        role: "admin",
      },
    });
    console.log(`Admin user created: ${email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
