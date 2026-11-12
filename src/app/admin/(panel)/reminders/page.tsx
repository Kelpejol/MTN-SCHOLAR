import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/shell";
import { ReminderEditor } from "@/components/admin/reminder-editor";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getReminderTemplate } from "@/lib/mail/reminder-template";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const admin = await requireAdmin();
  const [template, pendingTotal, sentTotal, lastLog] = await Promise.all([
    getReminderTemplate(),
    prisma.scholar.count({ where: { vote: { is: null } } }),
    prisma.reminderLog.count({ where: { status: "SENT" } }),
    prisma.reminderLog.findFirst({ where: { status: "SENT" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const { isCustom, updatedAt, ...saved } = template;

  return (
    <>
      <PageHeader
        title="Reminders"
        description="Write the reminder email, preview exactly how scholars will see it, then send it when you're ready. Nothing is sent automatically."
      />
      <ReminderEditor
        saved={saved}
        isCustom={isCustom}
        updatedAt={updatedAt ? formatDateTime(updatedAt) : null}
        pendingTotal={pendingTotal}
        sentTotal={sentTotal}
        lastSent={lastLog ? formatDateTime(lastLog.createdAt) : null}
        from={`${env.mailFromName} <${env.mailFromAddress}>`}
        adminEmail={admin.email}
      />
    </>
  );
}
