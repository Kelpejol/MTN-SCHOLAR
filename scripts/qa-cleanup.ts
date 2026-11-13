/**
 * Removes QA test data after testing:   npm run qa:cleanup            (preview only — changes nothing)
 *                                       npm run qa:cleanup -- --yes   (actually delete)
 *
 * It ONLY touches scholars whose matric number starts with "QA/" and the votes, sign-in codes and
 * reminder records that belong to them. Real scholars are never matched. Institutions, the voting
 * window, admins and the activity log are left alone.
 */
import { PrismaClient } from "@prisma/client";

const PREFIX = "QA/";
const prisma = new PrismaClient();

async function main() {
  const execute = process.argv.includes("--yes");
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;

  const scholars = await prisma.scholar.findMany({
    where: { matricNumber: { startsWith: PREFIX } },
    select: { id: true, matricDisplay: true, fullName: true, email: true, vote: { select: { id: true } } },
    orderBy: { matricNumber: "asc" },
  });
  // Belt and braces: never act on anything that doesn't carry the prefix.
  const ids = scholars.filter((s) => s.matricDisplay.toUpperCase().replace(/\s+/g, "").startsWith(PREFIX)).map((s) => s.id);

  const [votes, otps, reminders, totalScholars, totalVotes] = await Promise.all([
    prisma.vote.count({ where: { scholarId: { in: ids } } }),
    prisma.otpCode.count({ where: { scholarId: { in: ids } } }),
    prisma.reminderLog.count({ where: { scholarId: { in: ids } } }),
    prisma.scholar.count(),
    prisma.vote.count(),
  ]);

  console.log(`Database "${db}" — ${totalScholars} scholars and ${totalVotes} votes in total.`);
  console.log(`Matched ${ids.length} QA scholar(s) (matric starting "${PREFIX}"):`);
  for (const s of scholars) console.log(`  ${s.matricDisplay.padEnd(18)} ${s.fullName}  <${s.email}>${s.vote ? "  [voted]" : ""}`);
  console.log(`Linked records: ${votes} vote(s), ${otps} sign-in code(s), ${reminders} reminder log(s).`);

  if (!ids.length) return console.log("Nothing to clean up.");
  if (!execute) return console.log("\nPreview only. Re-run with  --yes  to delete these.");

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { scholarId: { in: ids } } }),
    prisma.otpCode.deleteMany({ where: { scholarId: { in: ids } } }),
    prisma.reminderLog.deleteMany({ where: { scholarId: { in: ids } } }),
    prisma.scholar.deleteMany({ where: { id: { in: ids } } }),
  ]);
  const [left, leftVotes] = await Promise.all([prisma.scholar.count(), prisma.vote.count()]);
  console.log(`\n✔ Deleted ${ids.length} scholar(s) and ${votes} vote(s). Remaining: ${left} scholars, ${leftVotes} votes.`);
}

main()
  .catch((e) => {
    console.error(`✖ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
