/**
 * Create an admin, or reset an existing admin's password.
 *
 *   npm run admin:create -- --email jane@example.com --name "Jane Doe" --password "a-long-password"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email")?.trim().toLowerCase();
  const name = arg("--name")?.trim() || "Administrator";
  const password = arg("--password");
  if (!email || !password) {
    console.error('Usage: npm run admin:create -- --email <email> --password <password> [--name "Full Name"]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Password must be at least 10 characters.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.admin.upsert({
      where: { email },
      update: { passwordHash, name },
      create: { email, name, passwordHash },
    });
    console.log(`Admin ready: ${admin.name} <${admin.email}>`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
