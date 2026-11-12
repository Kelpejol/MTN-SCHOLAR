import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function logAudit(
  adminId: string | null,
  action: string,
  summary: string,
  details?: Prisma.InputJsonValue,
) {
  try {
    await prisma.auditLog.create({ data: { adminId, action, summary, details } });
  } catch (error) {
    // Auditing must never break the action being audited.
    console.error("[audit] failed to write log", error);
  }
}
