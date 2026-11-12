"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, isUniqueViolation } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/http";
import { clearAdminSession, setAdminSession } from "@/lib/session";
import { CEREMONY_REGION_VALUES, GEOPOLITICAL_ZONES, LIMITS } from "@/lib/constants";
import { findSimilarInstitutions, normalizeInstitutionName, type InstitutionMatch } from "@/lib/institution-match";
import { cleanText, isValidEmail, normalizeEmail, normalizeMatric } from "@/lib/utils";
import { formatFullMoment, fromWatInputValue } from "@/lib/time";
import { sendMail } from "@/lib/mail/zeptomail";
import { reminderEmail, testEmail } from "@/lib/mail/templates";
import { PLACEHOLDERS, reminderTemplateSchema, type ReminderTemplateInput } from "@/lib/mail/placeholders";
import { getVotingConfig } from "@/lib/voting";
import type { GeopoliticalZone } from "@prisma/client";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ─────────────────────────────── Auth ───────────────────────────────

export type LoginState = { error?: string; email?: string } | undefined;

// Compared against when the email doesn't exist, so response timing doesn't reveal valid emails.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5Vq0z0Xgk6lJk3N6S8b1dYgMHPj8iG.";

export async function adminLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const { ip } = await getRequestMeta();
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: `email:${email}`, success: false, createdAt: { gte: since } } }),
    ip
      ? prisma.loginAttempt.count({ where: { key: `ip:${ip}`, success: false, createdAt: { gte: since } } })
      : 0,
  ]);
  if (byEmail >= 5 || byIp >= 20) {
    return { error: "Too many failed attempts. Please wait 15 minutes and try again.", email };
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  const keys = [`email:${email}`, ...(ip ? [`ip:${ip}`] : [])];
  await prisma.loginAttempt.createMany({ data: keys.map((key) => ({ key, success: valid && !!admin })) });

  if (!admin || !valid) return { error: "Incorrect email or password.", email };

  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await setAdminSession(admin.id);
  await logAudit(admin.id, "admin.login", `${admin.name} signed in`);
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin/login");
}

// ─────────────────────────── Institutions ───────────────────────────

const zoneValues = GEOPOLITICAL_ZONES.map((z) => z.value) as [string, ...string[]];

const institutionSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(2, "Enter the institution's name.").max(LIMITS.institutionNameMax, "Name is too long.")),
  location: z
    .string()
    .optional()
    .transform((v) => cleanText(v) || null)
    .pipe(z.string().max(LIMITS.locationMax, "Location is too long.").nullable()),
  geopoliticalZone: z
    .string()
    .optional()
    .transform((v) => v || null)
    .pipe(z.enum(zoneValues, { message: "Choose a valid geopolitical zone." }).nullable()),
  ceremonyRegion: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || CEREMONY_REGION_VALUES.includes(v), "Choose a valid ceremony region."),
  confirmSimilar: z.boolean().optional(),
});

export type InstitutionInput = z.input<typeof institutionSchema>;

export async function checkInstitutionName(name: string, excludeId?: string): Promise<InstitutionMatch[]> {
  await requireAdmin();
  const existing = await prisma.institution.findMany({ select: { id: true, name: true, normalizedName: true } });
  return findSimilarInstitutions(name, existing, { excludeId });
}

export async function saveInstitution(
  input: InstitutionInput,
): Promise<ActionResult<{ id: string }> | { ok: false; error: string; similar: InstitutionMatch[] }> {
  const admin = await requireAdmin();
  const parsed = institutionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await prisma.institution.findMany({ select: { id: true, name: true, normalizedName: true } });
  const matches = findSimilarInstitutions(data.name, existing, { excludeId: data.id });
  const exact = matches.find((m) => m.kind === "exact");
  if (exact) return { ok: false, error: `“${exact.name}” already exists.`, similar: [exact] };
  if (matches.length && !data.confirmSimilar) {
    return { ok: false, error: "This looks similar to an existing institution.", similar: matches };
  }

  const record = {
    name: data.name,
    normalizedName: normalizeInstitutionName(data.name),
    location: data.location,
    geopoliticalZone: data.geopoliticalZone as GeopoliticalZone | null,
    ceremonyRegion: data.ceremonyRegion,
  };

  try {
    if (data.id) {
      const before = await prisma.institution.findUnique({ where: { id: data.id } });
      if (!before) return { ok: false, error: "Institution not found." };
      await prisma.institution.update({ where: { id: data.id }, data: record });
      await logAudit(admin.id, "institution.update", `Updated institution “${data.name}”`, {
        before: { name: before.name, location: before.location, zone: before.geopoliticalZone, region: before.ceremonyRegion },
        after: { name: record.name, location: record.location, zone: record.geopoliticalZone, region: record.ceremonyRegion },
      });
      revalidatePath("/admin", "layout");
      return { ok: true, id: data.id };
    }
    const created = await prisma.institution.create({ data: record, select: { id: true } });
    await logAudit(admin.id, "institution.create", `Added institution “${data.name}”`, {
      region: record.ceremonyRegion,
      overrodeSimilar: matches.map((m) => m.name),
    });
    revalidatePath("/admin", "layout");
    return { ok: true, id: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "An institution with this name already exists." };
    throw error;
  }
}

export async function setInstitutionActive(id: string, isActive: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const inst = await prisma.institution.update({ where: { id }, data: { isActive } }).catch(() => null);
  if (!inst) return { ok: false, error: "Institution not found." };
  await logAudit(
    admin.id,
    isActive ? "institution.show" : "institution.hide",
    `${isActive ? "Showed" : "Hid"} “${inst.name}” ${isActive ? "on" : "from"} the ballot`,
  );
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteInstitution(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const inst = await prisma.institution.findUnique({ where: { id }, include: { _count: { select: { votes: true } } } });
  if (!inst) return { ok: false, error: "Institution not found." };
  if (inst._count.votes > 0) {
    return { ok: false, error: "This institution has votes, so it can't be deleted. Hide it from the ballot instead." };
  }
  await prisma.institution.delete({ where: { id } });
  await logAudit(admin.id, "institution.delete", `Deleted institution “${inst.name}”`);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ───────────────────────────── Scholars ─────────────────────────────

export type ScholarInput = { id?: string; fullName: string; matric: string; email: string };

export async function saveScholar(input: ScholarInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const fullName = cleanText(input.fullName);
  const matricDisplay = cleanText(input.matric);
  const matricNumber = normalizeMatric(input.matric);
  const email = normalizeEmail(input.email);

  if (!fullName) return { ok: false, error: "Enter the scholar's full name." };
  if (fullName.length > LIMITS.nameMax) return { ok: false, error: "Full name is too long." };
  if (!matricNumber) return { ok: false, error: "Enter a matric number." };
  if (matricNumber.length > LIMITS.matricMax) return { ok: false, error: "Matric number is too long." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };

  try {
    if (input.id) {
      const before = await prisma.scholar.findUnique({ where: { id: input.id } });
      if (!before) return { ok: false, error: "Scholar not found." };
      await prisma.scholar.update({ where: { id: input.id }, data: { fullName, matricNumber, matricDisplay, email } });
      await logAudit(admin.id, "scholar.update", `Updated scholar ${matricDisplay}`, {
        before: { fullName: before.fullName, matric: before.matricDisplay, email: before.email },
        after: { fullName, matric: matricDisplay, email },
      });
    } else {
      await prisma.scholar.create({ data: { fullName, matricNumber, matricDisplay, email } });
      await logAudit(admin.id, "scholar.create", `Added scholar ${matricDisplay} (${fullName})`);
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: `Matric number ${matricDisplay} already exists.` };
    throw error;
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteScholar(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const scholar = await prisma.scholar.findUnique({ where: { id }, include: { vote: { select: { id: true } } } });
  if (!scholar) return { ok: false, error: "Scholar not found." };
  if (scholar.vote) return { ok: false, error: "This scholar has already voted, so they can't be deleted." };
  await prisma.scholar.delete({ where: { id } });
  await logAudit(admin.id, "scholar.delete", `Deleted scholar ${scholar.matricDisplay} (${scholar.fullName})`);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ───────────────────────────── Settings ─────────────────────────────

export async function updateVotingWindow(input: { opensAt: string; closesAt: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const opensAt = fromWatInputValue(input.opensAt);
  const closesAt = fromWatInputValue(input.closesAt);
  if (!opensAt || !closesAt) return { ok: false, error: "Enter valid dates and times." };
  if (closesAt <= opensAt) return { ok: false, error: "Closing time must be after opening time." };
  await prisma.votingConfig.upsert({
    where: { id: 1 },
    update: { opensAt, closesAt },
    create: { id: 1, opensAt, closesAt },
  });
  await logAudit(
    admin.id,
    "settings.window",
    `Set voting window: ${formatFullMoment(opensAt)} → ${formatFullMoment(closesAt)}`,
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setVotingPaused(isPaused: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const config = await prisma.votingConfig.findUnique({ where: { id: 1 } });
  if (!config) return { ok: false, error: "Save the voting window first." };
  await prisma.votingConfig.update({ where: { id: 1 }, data: { isPaused } });
  await logAudit(admin.id, isPaused ? "settings.pause" : "settings.resume", isPaused ? "Paused voting" : "Resumed voting");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function sendTestEmail(to: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const email = normalizeEmail(to);
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const res = await sendMail({ to: { email, name: admin.name }, ...testEmail({ adminName: admin.name }) });
  if (!res.ok) return { ok: false, error: res.error };
  await logAudit(admin.id, "settings.test-email", `Sent a test email to ${email}`);
  return { ok: true };
}

// ────────────────────────────── Admins ──────────────────────────────

export async function createAdmin(input: { name: string; email: string; password: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = cleanText(input.name);
  const email = normalizeEmail(input.email);
  if (!name) return { ok: false, error: "Enter a name." };
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 10) return { ok: false, error: "Password must be at least 10 characters." };
  try {
    await prisma.admin.create({ data: { name, email, passwordHash: await bcrypt.hash(input.password, 12) } });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "An admin with this email already exists." };
    throw error;
  }
  await logAudit(admin.id, "admin.create", `Added admin ${name} <${email}>`);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function removeAdmin(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (id === admin.id) return { ok: false, error: "You can't remove your own account." };
  const count = await prisma.admin.count();
  if (count <= 1) return { ok: false, error: "At least one admin is required." };
  const target = await prisma.admin.delete({ where: { id } }).catch(() => null);
  if (!target) return { ok: false, error: "Admin not found." };
  await logAudit(admin.id, "admin.delete", `Removed admin ${target.name} <${target.email}>`);
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function changeOwnPassword(input: { current: string; next: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const record = await prisma.admin.findUnique({ where: { id: admin.id } });
  if (!record || !(await bcrypt.compare(input.current, record.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  if (input.next.length < 10) return { ok: false, error: "New password must be at least 10 characters." };
  await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(input.next, 12) } });
  await logAudit(admin.id, "admin.password", `${admin.name} changed their password`);
  return { ok: true };
}

// ─────────────────────────── Reminder email ───────────────────────────

export async function saveReminderTemplate(input: ReminderTemplateInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = reminderTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await prisma.reminderTemplate.upsert({
    where: { id: 1 },
    update: { ...parsed.data, updatedById: admin.id },
    create: { id: 1, ...parsed.data, updatedById: admin.id },
  });
  await logAudit(admin.id, "reminder.template", "Updated the reminder email message");
  revalidatePath("/admin/reminders");
  return { ok: true };
}

export async function resetReminderTemplate(): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.reminderTemplate.deleteMany({ where: { id: 1 } });
  await logAudit(admin.id, "reminder.template", "Reset the reminder email message to the default");
  revalidatePath("/admin/reminders");
  return { ok: true };
}

/** Sends the (possibly unsaved) draft to the admin, filled with sample scholar details. */
export async function sendReminderTest(input: ReminderTemplateInput, to: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = reminderTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const email = normalizeEmail(to);
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  const config = await getVotingConfig();
  const mail = reminderEmail({
    template: parsed.data,
    recipient: { fullName: PLACEHOLDERS[0].sample, matric: PLACEHOLDERS[2].sample, email },
    closesAtLabel: formatFullMoment(config.closesAt),
  });
  const res = await sendMail({
    to: { email, name: admin.name },
    subject: `[Test] ${mail.subject}`,
    html: mail.html,
    text: mail.text,
  });
  if (!res.ok) return { ok: false, error: res.error };
  await logAudit(admin.id, "reminder.test", `Sent a test reminder to ${email}`);
  return { ok: true };
}
