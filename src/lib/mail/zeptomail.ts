import "server-only";
import { env } from "../env";

export type MailMessage = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
};

export type MailResult = { ok: true } | { ok: false; error: string };

function authHeader(token: string) {
  return /^zoho-enczapikey\s/i.test(token) ? token : `Zoho-enczapikey ${token}`;
}

async function post(body: unknown): Promise<Response> {
  return fetch(env.zeptoApiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(env.zeptoToken),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

async function describeFailure(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: { message?: string; details?: { message?: string; target?: string }[] };
      message?: string;
    };
    const detail = data.error?.details?.[0];
    return [
      `ZeptoMail ${res.status}`,
      data.error?.message ?? data.message,
      detail?.message && `${detail.message}${detail.target ? ` (${detail.target})` : ""}`,
    ]
      .filter(Boolean)
      .join(": ");
  } catch {
    return `ZeptoMail ${res.status}`;
  }
}

/** Sends one transactional email through ZeptoMail. Never throws. */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (env.mailDryRun) {
    console.info(
      `\n[mail:dry-run] To: ${message.to.name ?? ""} <${message.to.email}>\n` +
        `Subject: ${message.subject}\n${message.text}\n`,
    );
    return { ok: true };
  }
  if (!env.zeptoToken) return { ok: false, error: "Email is not configured (ZEPTOMAIL_TOKEN missing)." };

  const body = {
    from: { address: env.mailFromAddress, name: env.mailFromName },
    to: [{ email_address: { address: message.to.email, name: message.to.name || message.to.email } }],
    reply_to: [{ address: env.supportEmail, name: env.mailFromName }],
    subject: message.subject,
    htmlbody: message.html,
    textbody: message.text,
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await post(body);
      if (res.ok) return { ok: true };
      const error = await describeFailure(res);
      // Retry once on throttling / server errors; client errors won't succeed on retry.
      if (attempt === 1 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      console.error("[mail] send failed", error);
      return { ok: false, error };
    } catch (err) {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      const error = err instanceof Error ? err.message : "Network error";
      console.error("[mail] send error", error);
      return { ok: false, error: `Could not reach ZeptoMail: ${error}` };
    }
  }
  return { ok: false, error: "Unknown email error" };
}
