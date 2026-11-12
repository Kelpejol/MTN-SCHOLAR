/**
 * Safe schema setup for a SHARED MySQL database (other apps live in the same database).
 *
 *   npm run db:migrate
 *
 * - Only ever creates tables prefixed `mtnvc_` (plus Prisma's `_prisma_migrations` bookkeeping table).
 * - The migration SQL contains no DROP/DELETE/TRUNCATE; this script refuses to run if that changes.
 * - First run: executes each migration's SQL and records it as applied (Prisma's own
 *   `migrate deploy` refuses to start on a database that already contains other apps' tables).
 * - Later runs: hands over to `prisma migrate deploy`, which applies only new migrations.
 * - Never resets, never drops, never touches tables it didn't create.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "prisma", "migrations");
const schema = path.join(root, "prisma", "schema.prisma");
const prismaBin = path.join(root, "node_modules", ".bin", "prisma");

function run(args: string[]) {
  execFileSync(prismaBin, args, { stdio: "inherit", cwd: root, env: process.env });
}

async function main() {
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (!migrations.length) throw new Error("No migrations found.");

  // Safety net: refuse to run anything destructive.
  for (const name of migrations) {
    const sql = readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
    if (/\b(DROP|TRUNCATE|DELETE\s+FROM)\b/i.test(sql)) {
      throw new Error(`Migration ${name} contains a destructive statement; refusing to run it on a shared database.`);
    }
    const tables = [...sql.matchAll(/(?:CREATE|ALTER)\s+TABLE\s+`([^`]+)`/gi)].map((m) => m[1]);
    const foreign = tables.filter((t) => !t.startsWith("mtnvc_"));
    if (foreign.length) throw new Error(`Migration ${name} touches non-mtnvc_ tables: ${foreign.join(", ")}`);
  }

  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`;
  const existing = await prisma.$queryRaw<{ t: string }[]>`
    SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  const names = new Set(existing.map((r) => r.t));
  const ours = [...names].filter((t) => t.startsWith("mtnvc_"));
  const others = [...names].filter((t) => !t.startsWith("mtnvc_") && t !== "_prisma_migrations");
  console.log(`Database "${db}": ${others.length} table(s) belong to other apps (left untouched), ${ours.length} are ours.`);

  const hasHistory = names.has("_prisma_migrations");
  let applied = new Set<string>();
  if (hasHistory) {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    applied = new Set(rows.map((r) => r.migration_name));
  }
  await prisma.$disconnect();

  if (hasHistory && migrations.every((m) => applied.has(m))) {
    console.log("Schema is up to date. Nothing to do.");
    return;
  }

  if (hasHistory) {
    // Our migration history already exists in this database — let Prisma apply anything new.
    console.log("Applying new migrations…");
    run(["migrate", "deploy", "--schema", schema]);
    return;
  }

  if (ours.length) {
    throw new Error(
      `Found existing mtnvc_ tables (${ours.join(", ")}) but no migration history. Refusing to guess — ` +
        "stop here and check the database by hand.",
    );
  }

  // First-time setup on a database that may already hold other apps' tables.
  for (const name of migrations) {
    const file = path.join(migrationsDir, name, "migration.sql");
    if (!existsSync(file)) continue;
    console.log(`Creating tables from ${name}…`);
    run(["db", "execute", "--schema", schema, "--file", file]);
    run(["migrate", "resolve", "--schema", schema, "--applied", name]);
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
