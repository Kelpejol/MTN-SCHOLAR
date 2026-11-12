import "server-only";
import { BRAND, OTP } from "../constants";
import { env } from "../env";
import {
  findUnknownPlaceholders,
  fillPlaceholders,
  type PlaceholderValues,
  type ReminderTemplateInput,
} from "./placeholders";

// Email-safe, table-based layout with inline styles. Brand: white, black and dark red.
const C = {
  red: "#8F1D22",
  /** Exact red from the Dragnet logo — used sparingly as an accent. */
  dragnet: "#FB0102",
  black: "#0A0A0A",
  text: "#3F3F46",
  muted: "#71717A",
  border: "#E4E4E7",
  canvas: "#F4F4F5",
  soft: "#FAFAFA",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "Scholar";
}

function layout({ preheader, body }: { preheader: string; body: string }): string {
  const base = env.appUrl;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(BRAND.awardName)}</title>
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.canvas};">
<tr><td align="center" style="padding:28px 12px 36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(10,10,10,.08),0 12px 32px -12px rgba(10,10,10,.18);">
  <!-- Accent bar: Dragnet red + black, echoing the logo -->
  <tr><td style="padding:0;font-size:0;line-height:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="30%" style="height:6px;background:${C.dragnet};font-size:0;line-height:0;">&nbsp;</td>
      <td width="70%" style="height:6px;background:${C.black};font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td></tr>
  <!-- Header -->
  <tr><td style="padding:26px 36px 22px 36px;font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="64" valign="middle"><img src="${base}${BRAND.mtnLogo}" alt="MTN" width="64" style="display:block;width:64px;height:auto;border:0;border-radius:10px;"></td>
      <td valign="middle" style="padding-left:14px;">
        <p style="margin:0;font-size:15px;line-height:20px;font-weight:700;color:${C.black};letter-spacing:-.01em;">${esc(BRAND.programName)}</p>
        <p style="margin:2px 0 0 0;font-size:12px;line-height:16px;color:${C.muted};">${esc(BRAND.awardName)}</p>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:0 36px;"><div style="height:1px;background:${C.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
  <!-- Content -->
  <tr><td style="padding:34px 36px 12px 36px;font-family:${FONT};">
    ${body}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:${C.black};border-top:3px solid ${C.dragnet};padding:26px 36px;font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="middle" style="padding-right:16px;">
        <p style="margin:0;font-size:12px;line-height:18px;color:#A1A1AA;">${esc(BRAND.programName)}</p>
        <p style="margin:6px 0 0 0;font-size:12px;line-height:18px;color:#A1A1AA;">Questions? Reply to this email or write to <a href="mailto:${esc(env.supportEmail)}" style="color:#FFFFFF;text-decoration:underline;">${esc(env.supportEmail)}</a></p>
      </td>
      <td valign="middle" align="right" width="104">
        <p style="margin:0 0 6px 0;font-size:10px;line-height:12px;letter-spacing:.1em;text-transform:uppercase;color:#71717A;text-align:right;">Powered by</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="background:#FFFFFF;border-radius:8px;padding:6px 10px;"><img src="${base}${BRAND.dragnetLogo}" alt="${esc(BRAND.poweredByFull)}" height="40" style="display:block;height:40px;width:auto;border:0;"></td></tr></table>
      </td>
    </tr></table>
  </td></tr>
</table>
<p style="margin:18px 0 0 0;font-family:${FONT};font-size:11px;line-height:16px;color:${C.muted};text-align:center;">You're receiving this because you're a registered ${esc(BRAND.programName)} scholar.</p>
</td></tr>
</table>
</body>
</html>`;
}

function heading(text: string) {
  return `<h1 style="margin:0;font-size:26px;line-height:34px;color:${C.black};font-weight:800;letter-spacing:-.02em;">${esc(text)}</h1>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 22px 0;"><tr><td style="width:44px;height:4px;background:${C.dragnet};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}
function para(html: string) {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${C.text};">${html}</p>`;
}
function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr>
<td style="border-radius:10px;background:${C.red};">
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${esc(label)}</a>
</td></tr></table>`;
}
function detailRows(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;background:${C.soft};border:1px solid ${C.border};border-radius:12px;">
${rows
  .map(
    ([k, v], i) => `<tr><td style="padding:14px 18px;${i ? `border-top:1px solid ${C.border};` : ""}font-family:${FONT};">
<p style="margin:0 0 2px 0;font-size:12px;color:${C.muted};text-transform:uppercase;letter-spacing:.06em;">${esc(k)}</p>
<p style="margin:0;font-size:15px;line-height:22px;color:${C.black};font-weight:600;">${esc(v)}</p></td></tr>`,
  )
  .join("")}
</table>`;
}

export type RenderedEmail = { subject: string; html: string; text: string };

export function otpEmail({ fullName, code }: { fullName: string; code: string }): RenderedEmail {
  const name = firstName(fullName);
  const spaced = code.split("").join(" ");
  const body = `${heading("Your one-time voting code")}
${para(`Hello ${esc(name)}, use the code below to sign in and vote for the <strong>${esc(BRAND.awardName)}</strong>.`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;">
<tr><td align="center" style="padding:22px 12px;background:${C.soft};border:1px solid ${C.border};border-radius:12px;">
<span style="font-family:'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace;font-size:34px;line-height:40px;letter-spacing:10px;font-weight:700;color:${C.black};">${esc(code)}</span>
</td></tr></table>
${para(`This code expires in <strong>${OTP.ttlMinutes} minutes</strong> and can only be used once. Never share it with anyone, including anyone claiming to be from the ${esc(BRAND.programName)}.`)}
${para(`<span style="color:${C.muted};font-size:13px;">Didn't request this code? You can safely ignore this email. Your vote is secure.</span>`)}`;
  return {
    subject: `${code} is your voting code — ${BRAND.awardShortName}`,
    html: layout({ preheader: `Your code is ${spaced}. It expires in ${OTP.ttlMinutes} minutes.`, body }),
    text: `Hello ${name},

Your one-time voting code for the ${BRAND.awardName} is: ${code}

It expires in ${OTP.ttlMinutes} minutes and can only be used once. Never share it with anyone.

If you didn't request this code, you can safely ignore this email.

${BRAND.programName} · Powered by ${BRAND.poweredByFull}`,
  };
}

/** Admin-written message → email-safe HTML paragraphs. Supports **bold** and blank-line paragraphs. */
function renderBodyHtml(body: string, values: PlaceholderValues): string {
  return body
    .split(/\n{2,}/)
    .map((block) => {
      const withBold = esc(block.trim()).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
      const filled = fillPlaceholders(withBold, values, (key, value) =>
        key === "voting_link"
          ? `<a href="${esc(value)}" style="color:${C.red};">${esc(value)}</a>`
          : esc(value),
      );
      return para(filled.replace(/\n/g, "<br>"));
    })
    .join("\n");
}

export type ReminderRecipient = { fullName: string; matric: string; email: string };

/**
 * The reminder email, built from the admin-editable template. Used for real sends, test
 * sends and the live preview, so what admins see is exactly what scholars get.
 */
export function reminderEmail({
  template,
  recipient,
  closesAtLabel,
}: {
  template: ReminderTemplateInput;
  recipient: ReminderRecipient;
  closesAtLabel: string;
}): RenderedEmail & { unknownPlaceholders: string[] } {
  const url = env.appUrl;
  const values: PlaceholderValues = {
    full_name: recipient.fullName,
    first_name: firstName(recipient.fullName),
    matric_number: recipient.matric,
    email: recipient.email,
    voting_link: url,
    closing_date: closesAtLabel,
  };
  const plain = (text: string) => fillPlaceholders(text, values);
  const subject = plain(template.subject).replace(/\s+/g, " ").trim();
  const headingText = plain(template.heading).replace(/\s+/g, " ").trim();

  const steps = template.showSteps
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
${[
  ["1", "Enter your matric number on the voting page."],
  ["2", "Type the one-time code we send to this email address."],
  ["3", "Choose an institution, enter the Vice-Chancellor's name and confirm."],
]
  .map(
    ([n, t]) => `<tr><td valign="top" style="padding:0 12px 12px 0;width:28px;">
<div style="width:26px;height:26px;border-radius:13px;background:${C.black};color:#FFFFFF;font-family:${FONT};font-size:13px;font-weight:700;line-height:26px;text-align:center;">${n}</div></td>
<td valign="top" style="padding:3px 0 12px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${C.text};">${esc(t)}</td></tr>`,
  )
  .join("")}
</table>`
    : "";

  const body = `${heading(headingText)}
${renderBodyHtml(template.body, values)}
${button(url, plain(template.buttonLabel))}
${steps}
${para(`<span style="color:${C.muted};font-size:13px;">Each matric number can vote once, and votes cannot be changed after submission. If the button doesn't work, copy this link into your browser: <a href="${esc(url)}" style="color:${C.red};">${esc(url)}</a></span>`)}`;

  const text = `${headingText}

${plain(template.body).replace(/\*\*([\s\S]+?)\*\*/g, "$1")}

${plain(template.buttonLabel)}: ${url}
${template.showSteps ? `
1. Enter your matric number on the voting page.
2. Type the one-time code we send to this email address.
3. Choose an institution, enter the Vice-Chancellor's name and confirm.
` : ""}
Each matric number can vote once, and votes cannot be changed after submission.

${BRAND.programName} · Powered by ${BRAND.poweredByFull}`;

  return {
    subject,
    html: layout({ preheader: headingText, body }),
    text,
    unknownPlaceholders: findUnknownPlaceholders(template.subject, template.heading, template.body, template.buttonLabel),
  };
}

export function voteReceiptEmail({
  fullName,
  matric,
  institution,
  vcName,
  votedAtLabel,
}: {
  fullName: string;
  matric: string;
  institution: string;
  vcName: string;
  votedAtLabel: string;
}): RenderedEmail {
  const name = firstName(fullName);
  const body = `${heading("Thank you — your vote is in")}
${para(`Hello ${esc(name)}, your vote for the <strong>${esc(BRAND.awardName)}</strong> has been recorded. Here is your receipt:`)}
${detailRows([
  ["Matric number", matric],
  ["Institution", institution],
  ["Vice-Chancellor (as entered)", vcName],
  ["Submitted", votedAtLabel],
])}
${para(`<span style="color:${C.muted};font-size:13px;">Votes are final and cannot be changed. If you did not cast this vote, contact us immediately at ${esc(env.supportEmail)}.</span>`)}`;
  return {
    subject: `Vote received — ${BRAND.awardShortName}`,
    html: layout({ preheader: `Your vote for ${institution} has been recorded.`, body }),
    text: `Hello ${name},

Your vote for the ${BRAND.awardName} has been recorded.

Matric number: ${matric}
Institution: ${institution}
Vice-Chancellor (as entered): ${vcName}
Submitted: ${votedAtLabel}

Votes are final and cannot be changed. If you did not cast this vote, contact ${env.supportEmail} immediately.

${BRAND.programName} · Powered by ${BRAND.poweredByFull}`,
  };
}

export function testEmail({ adminName }: { adminName: string }): RenderedEmail {
  const body = `${heading("Email delivery is working")}
${para(`Hi ${esc(adminName)}, this is a test message from the ${esc(BRAND.awardName)} platform. If you can read this, ZeptoMail is configured correctly and logos load from <strong>${esc(env.appUrl)}</strong>.`)}`;
  return {
    subject: `Test email — ${BRAND.awardShortName}`,
    html: layout({ preheader: "ZeptoMail is configured correctly.", body }),
    text: `Hi ${adminName}, this is a test message from the ${BRAND.awardName} platform. ZeptoMail is configured correctly.`,
  };
}
