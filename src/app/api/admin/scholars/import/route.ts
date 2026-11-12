import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAdminApi, jsonError } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { ImportFileError, parseScholarFile, type ImportRecord } from "@/lib/scholar-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Classified = {
  created: ImportRecord[];
  updated: (ImportRecord & { changes: string[] })[];
  unchanged: number;
};

async function classify(records: ImportRecord[]): Promise<Classified & { existingIds: Map<string, string> }> {
  const existing = await prisma.scholar.findMany({
    where: { matricNumber: { in: records.map((r) => r.matricNumber) } },
    select: { id: true, matricNumber: true, matricDisplay: true, fullName: true, email: true },
  });
  const byMatric = new Map(existing.map((s) => [s.matricNumber, s]));
  const existingIds = new Map(existing.map((s) => [s.matricNumber, s.id]));
  const result: Classified = { created: [], updated: [], unchanged: 0 };
  for (const r of records) {
    const current = byMatric.get(r.matricNumber);
    if (!current) {
      result.created.push(r);
      continue;
    }
    const changes: string[] = [];
    if (current.fullName !== r.fullName) changes.push(`name: ${current.fullName} → ${r.fullName}`);
    if (current.email !== r.email) changes.push(`email: ${current.email} → ${r.email}`);
    if (current.matricDisplay !== r.matricDisplay) changes.push(`matric: ${current.matricDisplay} → ${r.matricDisplay}`);
    if (changes.length) result.updated.push({ ...r, changes });
    else result.unchanged++;
  }
  return { ...result, existingIds };
}

export async function POST(request: Request) {
  const guard = await guardAdminApi(request);
  if (guard.response) return guard.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Upload a .csv or .xlsx file.");
  }
  const file = form.get("file");
  const mode = form.get("mode") === "commit" ? "commit" : "preview";
  if (!(file instanceof File)) return jsonError("Upload a .csv or .xlsx file.");

  let parsed;
  try {
    parsed = await parseScholarFile(file);
  } catch (error) {
    if (error instanceof ImportFileError) return jsonError(error.message, 422);
    console.error("[import] parse failed", error);
    return jsonError("Could not read the file. Check it's a valid .csv or .xlsx file.", 422);
  }

  const classified = await classify(parsed.records);
  const summary = {
    fileName: file.name,
    sheetName: parsed.sheetName,
    totalRows: parsed.totalRows,
    valid: parsed.records.length,
    newCount: classified.created.length,
    updateCount: classified.updated.length,
    unchangedCount: classified.unchanged,
    errors: parsed.errors.slice(0, 200),
    errorCount: parsed.errors.length,
    warnings: parsed.warnings.slice(0, 100),
    warningCount: parsed.warnings.length,
    newSample: classified.created.slice(0, 8),
    updates: classified.updated.slice(0, 50),
  };

  if (mode === "preview") return Response.json({ ok: true, mode, summary });

  // Commit: insert new rows and apply changes in a single transaction.
  await prisma.$transaction(
    async (tx) => {
      if (classified.created.length) {
        await tx.scholar.createMany({
          data: classified.created.map((r) => ({
            fullName: r.fullName,
            matricNumber: r.matricNumber,
            matricDisplay: r.matricDisplay,
            email: r.email,
          })),
          skipDuplicates: true,
        });
      }
      for (const r of classified.updated) {
        await tx.scholar.update({
          where: { id: classified.existingIds.get(r.matricNumber)! },
          data: { fullName: r.fullName, matricDisplay: r.matricDisplay, email: r.email },
        });
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  await logAudit(
    guard.admin.id,
    "scholar.import",
    `Imported ${file.name}: ${summary.newCount} added, ${summary.updateCount} updated, ${summary.errorCount} skipped`,
    { file: file.name, added: summary.newCount, updated: summary.updateCount, skipped: summary.errorCount },
  );
  revalidatePath("/admin", "layout");
  return Response.json({ ok: true, mode, summary });
}
