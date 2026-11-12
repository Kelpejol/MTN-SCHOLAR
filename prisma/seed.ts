/**
 * Idempotent seed: institutions from the client's list, the default voting window and the
 * first admin account. Safe to run repeatedly — existing records (and admin edits) are kept.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_INSTITUTIONS } from "./data/institutions";
import { normalizeInstitutionName } from "../src/lib/institution-match";

const prisma = new PrismaClient();

const DEFAULT_OPENS_AT = "2026-11-13T00:00:00+01:00";
const DEFAULT_CLOSES_AT = "2026-11-16T23:59:00+01:00";

async function main() {
  let created = 0;
  for (const inst of SEED_INSTITUTIONS) {
    const normalizedName = normalizeInstitutionName(inst.name);
    const existing = await prisma.institution.findUnique({ where: { normalizedName } });
    if (existing) continue;
    await prisma.institution.create({ data: { ...inst, normalizedName } });
    created++;
  }
  console.log(`Institutions: ${created} created, ${SEED_INSTITUTIONS.length - created} already present.`);

  await prisma.votingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, opensAt: new Date(DEFAULT_OPENS_AT), closesAt: new Date(DEFAULT_CLOSES_AT) },
  });
  console.log("Voting window: ensured (edit it from Admin → Settings).");

  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME?.trim() || "Administrator";
  if (email && password) {
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      console.log(`Admin ${email}: already exists (password unchanged).`);
    } else {
      if (password.length < 10) throw new Error("ADMIN_SEED_PASSWORD must be at least 10 characters.");
      await prisma.admin.create({
        data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
      });
      console.log(`Admin ${email}: created.`);
    }
  } else {
    console.log("Admin: skipped (set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD to create one).");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
