import "server-only";
import { prisma } from "../db";
import { DEFAULT_REMINDER_TEMPLATE, type ReminderTemplateInput } from "./placeholders";

/** The saved reminder message, or the built-in default if the admin hasn't edited it. */
export async function getReminderTemplate(): Promise<ReminderTemplateInput & { isCustom: boolean; updatedAt: Date | null }> {
  const row = await prisma.reminderTemplate.findUnique({ where: { id: 1 } });
  if (!row) return { ...DEFAULT_REMINDER_TEMPLATE, isCustom: false, updatedAt: null };
  return {
    subject: row.subject,
    heading: row.heading,
    body: row.body,
    buttonLabel: row.buttonLabel,
    showSteps: row.showSteps,
    isCustom: true,
    updatedAt: row.updatedAt,
  };
}
