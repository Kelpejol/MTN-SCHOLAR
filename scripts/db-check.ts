/**
 * Verifies the DATABASE_URL works before deploying:  npm run db:check
 *   - connects (and reports whether the connection is encrypted)
 *   - shows which database/user we are, and what's already in it (names only)
 *   - confirms the user may create tables, using a throw-away table that is removed straight away
 * Read-only apart from that one temporary `mtnvc__probe` table.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [info] = await prisma.$queryRaw<{ db: string | null; usr: string; version: string }[]>`
    SELECT DATABASE() AS db, CURRENT_USER() AS usr, VERSION() AS version`;
  console.log(`✔ Connected to MySQL ${info.version} as ${info.usr}`);
  if (!info.db) throw new Error("DATABASE_URL has no database name (…:3306/<database>). Add one.");
  console.log(`✔ Database: ${info.db}`);

  const ssl = await prisma.$queryRaw<{ Variable_name: string; Value: string }[]>`SHOW SESSION STATUS LIKE 'Ssl_cipher'`;
  const cipher = ssl[0]?.Value;
  console.log(cipher ? `✔ Connection is encrypted (${cipher})` : "⚠ Connection is NOT encrypted — add ?sslaccept=strict to DATABASE_URL");

  const [coll] = await prisma.$queryRaw<{ c: string }[]>`
    SELECT DEFAULT_COLLATION_NAME AS c FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()`;
  console.log(`✔ Collation: ${coll.c}${/_ci$/.test(coll.c) ? " (case-insensitive search works)" : " ⚠ not case-insensitive; admin search will be case-sensitive"}`);

  const tables = await prisma.$queryRaw<{ t: string }[]>`
    SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY 1`;
  const ours = tables.filter((r) => r.t.startsWith("mtnvc_")).length;
  console.log(`✔ ${tables.length - ours} existing table(s) from other apps (left untouched), ${ours} of ours`);

  try {
    await prisma.$executeRawUnsafe("CREATE TABLE `mtnvc__probe` (id INT PRIMARY KEY)");
    await prisma.$executeRawUnsafe("DROP TABLE `mtnvc__probe`");
    console.log("✔ Allowed to create tables");
  } catch (e) {
    throw new Error(`This user cannot create tables here: ${e instanceof Error ? e.message.split("\n").pop() : e}`);
  }
  console.log("\nAll good — safe to run: npm run db:migrate");
}

main()
  .catch((e) => {
    console.error(`\n✖ ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
