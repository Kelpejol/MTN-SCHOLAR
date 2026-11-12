import { guardAdminApi, jsonError } from "@/lib/http";
import { reminderEmail } from "@/lib/mail/templates";
import { getReminderTemplate } from "@/lib/mail/reminder-template";
import { PLACEHOLDERS, reminderTemplateSchema } from "@/lib/mail/placeholders";
import { env } from "@/lib/env";
import { getVotingConfig } from "@/lib/voting";
import { formatFullMoment } from "@/lib/time";

export const dynamic = "force-dynamic";

const SAMPLE = {
  fullName: PLACEHOLDERS[0].sample,
  matric: PLACEHOLDERS[2].sample,
  email: PLACEHOLDERS[3].sample,
};

async function render(template: Parameters<typeof reminderEmail>[0]["template"]) {
  const config = await getVotingConfig();
  const mail = reminderEmail({
    template,
    recipient: SAMPLE,
    closesAtLabel: formatFullMoment(config.closesAt),
  });
  return {
    ok: true as const,
    html: mail.html,
    subject: mail.subject,
    unknownPlaceholders: mail.unknownPlaceholders,
    from: `${env.mailFromName} <${env.mailFromAddress}>`,
    to: `${SAMPLE.fullName} <${SAMPLE.email}>`,
  };
}

/** Preview of the *saved* template (used by the "Send reminders" dialog). */
export async function GET(request: Request) {
  const guard = await guardAdminApi(request);
  if (guard.response) return guard.response;
  return Response.json(await render(await getReminderTemplate()), { headers: { "Cache-Control": "no-store" } });
}

/** Live preview of an unsaved draft from the editor. */
export async function POST(request: Request) {
  const guard = await guardAdminApi(request);
  if (guard.response) return guard.response;
  const body = await request.json().catch(() => null);
  const parsed = reminderTemplateSchema.safeParse(body);
  // While typing, a field may be momentarily empty — fall back to rendering whatever we have.
  const draft = parsed.success
    ? parsed.data
    : {
        subject: String(body?.subject ?? "").slice(0, 150),
        heading: String(body?.heading ?? "").slice(0, 120),
        body: String(body?.body ?? "").slice(0, 3000),
        buttonLabel: String(body?.buttonLabel ?? "").slice(0, 40),
        showSteps: !!body?.showSteps,
      };
  if (!body) return jsonError("Invalid request.");
  return Response.json(await render(draft), { headers: { "Cache-Control": "no-store" } });
}
