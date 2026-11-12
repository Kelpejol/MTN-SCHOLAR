import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { guardAdminApi, jsonError } from "@/lib/http";
import { logAudit } from "@/lib/audit";
import { sendMail } from "@/lib/mail/zeptomail";
import { reminderEmail } from "@/lib/mail/templates";
import { getVotingConfig } from "@/lib/voting";
import { getReminderTemplate } from "@/lib/mail/reminder-template";
import { formatFullMoment } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reminders are sent in small batches driven by the browser (so progress is visible and no
 * single request runs long). Step 1 "targets" resolves who to email; step 2 "send" emails a batch.
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("targets"),
    scope: z.enum(["all", "selected"]),
    ids: z.array(z.string()).max(10_000).optional(),
    skipRecentHours: z.number().int().min(0).max(168).default(0),
  }),
  z.object({
    action: z.literal("send"),
    ids: z.array(z.string()).min(1).max(50),
    batchNumber: z.number().int().min(1).default(1),
    totalBatches: z.number().int().min(1).default(1),
    runTotal: z.number().int().min(0).default(0),
  }),
]);

const CONCURRENCY = 5;

export async function POST(request: Request) {
  const guard = await guardAdminApi(request);
  if (guard.response) return guard.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request.");
  const body = parsed.data;

  if (body.action === "targets") {
    const cutoff = body.skipRecentHours ? new Date(Date.now() - body.skipRecentHours * 3600 * 1000) : null;
    const scholars = await prisma.scholar.findMany({
      where: {
        vote: { is: null },
        ...(body.scope === "selected" ? { id: { in: body.ids ?? [] } } : {}),
        ...(cutoff ? { OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: cutoff } }] } : {}),
      },
      select: { id: true },
      orderBy: { fullName: "asc" },
    });
    return Response.json({ ok: true, ids: scholars.map((s) => s.id) });
  }

  const config = await getVotingConfig();
  const closesAtLabel = formatFullMoment(config.closesAt);
  const template = await getReminderTemplate();
  const scholars = await prisma.scholar.findMany({
    where: { id: { in: body.ids } },
    select: { id: true, fullName: true, matricDisplay: true, email: true, vote: { select: { id: true } } },
  });

  let sent = 0;
  let skipped = 0;
  const failures: { id: string; name: string; email: string; error: string }[] = [];

  const queue = [...scholars];
  async function worker() {
    for (let s = queue.shift(); s; s = queue.shift()) {
      if (s.vote) {
        skipped++; // voted since the list was built
        continue;
      }
      const mail = reminderEmail({
        template,
        recipient: { fullName: s.fullName, matric: s.matricDisplay, email: s.email },
        closesAtLabel,
      });
      const res = await sendMail({
        to: { email: s.email, name: s.fullName },
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      await prisma.reminderLog.create({
        data: {
          scholarId: s.id,
          status: res.ok ? "SENT" : "FAILED",
          error: res.ok ? null : res.error.slice(0, 500),
          adminId: guard.admin!.id,
        },
      });
      if (res.ok) {
        sent++;
        await prisma.scholar.update({
          where: { id: s.id },
          data: { reminderCount: { increment: 1 }, lastRemindedAt: new Date() },
        });
      } else {
        failures.push({ id: s.id, name: s.fullName, email: s.email, error: res.error });
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  skipped += body.ids.length - scholars.length; // deleted since the list was built

  if (body.batchNumber === body.totalBatches) {
    await logAudit(guard.admin.id, "reminder.send", `Sent reminder emails to ${body.runTotal} scholar(s)`, {
      requested: body.runTotal,
    });
    revalidatePath("/admin", "layout");
  }

  return Response.json({ ok: true, sent, skipped, failures });
}
