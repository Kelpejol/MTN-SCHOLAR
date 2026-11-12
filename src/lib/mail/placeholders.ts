// Placeholder engine for admin-written emails. Pure and client-safe (used for the editor UI
// and by the server when rendering).
import { z } from "zod";

export type PlaceholderKey =
  | "full_name"
  | "first_name"
  | "matric_number"
  | "email"
  | "voting_link"
  | "closing_date";

export const PLACEHOLDERS: { key: PlaceholderKey; label: string; hint: string; sample: string }[] = [
  { key: "full_name", label: "Full name", hint: "e.g. Adaeze Okafor", sample: "Adaeze Okafor" },
  { key: "first_name", label: "First name", hint: "e.g. Adaeze", sample: "Adaeze" },
  { key: "matric_number", label: "Matric number", hint: "As uploaded", sample: "EEG/2021/004" },
  { key: "email", label: "Email address", hint: "Where the email is sent", sample: "adaeze.okafor@example.com" },
  { key: "closing_date", label: "Closing date", hint: "When voting closes", sample: "" },
  { key: "voting_link", label: "Voting link", hint: "Link to the voting page", sample: "" },
];

// Forgiving: {{full name}}, {{Full_Name}}, {{ fullname }} and {{name}} all work.
const ALIASES: Record<string, PlaceholderKey> = {
  fullname: "full_name",
  name: "full_name",
  firstname: "first_name",
  matricnumber: "matric_number",
  matricno: "matric_number",
  matric: "matric_number",
  email: "email",
  emailaddress: "email",
  closingdate: "closing_date",
  closes: "closing_date",
  deadline: "closing_date",
  votinglink: "voting_link",
  votingurl: "voting_link",
  link: "voting_link",
};

const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function resolvePlaceholder(raw: string): PlaceholderKey | null {
  return ALIASES[raw.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null;
}

/** Placeholders written in `text` that we don't recognise (they are left as typed). */
export function findUnknownPlaceholders(...texts: string[]): string[] {
  const unknown = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(TOKEN)) if (!resolvePlaceholder(m[1])) unknown.add(`{{${m[1]}}}`);
  }
  return [...unknown];
}

export type PlaceholderValues = Record<PlaceholderKey, string>;

/** Replace placeholders; `wrap` lets the HTML renderer escape values / make links. */
export function fillPlaceholders(
  text: string,
  values: PlaceholderValues,
  wrap: (key: PlaceholderKey, value: string) => string = (_k, v) => v,
): string {
  return text.replace(TOKEN, (whole, inner: string) => {
    const key = resolvePlaceholder(inner);
    return key ? wrap(key, values[key]) : whole;
  });
}

export const reminderTemplateSchema = z.object({
  subject: z.string().trim().min(1, "Enter a subject line.").max(150, "The subject is too long (150 characters max)."),
  heading: z.string().trim().min(1, "Enter a heading.").max(120, "The heading is too long (120 characters max)."),
  body: z.string().trim().min(1, "Write a message.").max(3000, "The message is too long (3,000 characters max)."),
  buttonLabel: z.string().trim().min(1, "Enter the button text.").max(40, "Button text is too long (40 characters max)."),
  showSteps: z.boolean(),
});

export type ReminderTemplateInput = z.infer<typeof reminderTemplateSchema>;

export const DEFAULT_REMINDER_TEMPLATE: ReminderTemplateInput = {
  subject: "Reminder: cast your vote for the Scholars' Choice VC Award",
  heading: "Your vote hasn't been cast yet",
  body: `Hello {{first_name}},

As a scholar of the MTN Foundation Scholarship, you're invited to choose the winner of the **Scholars' Choice Vice-Chancellor Award** — recognising the Vice-Chancellor who has shown the greatest commitment to students' welfare, learning and wellbeing.

Voting closes on **{{closing_date}}**. It takes less than a minute.`,
  buttonLabel: "Cast your vote",
  showSteps: true,
};
