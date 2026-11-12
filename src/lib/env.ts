import "server-only";

/**
 * Centralised environment access. Values are read lazily so `next build` works without
 * production secrets; anything missing at runtime fails loudly with a clear message.
 */

const isProd = process.env.NODE_ENV === "production";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get sessionSecret(): string {
    const value = required("SESSION_SECRET");
    if (value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long.");
    return value;
  },
  get appUrl(): string {
    return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  },
  get zeptoToken(): string {
    return process.env.ZEPTOMAIL_TOKEN?.trim() ?? "";
  },
  get zeptoApiUrl(): string {
    return process.env.ZEPTOMAIL_API_URL?.trim() || "https://api.zeptomail.com/v1.1/email";
  },
  get mailFromAddress(): string {
    return process.env.MAIL_FROM_ADDRESS?.trim() || "mtnfscholars@dragnet-solutions.com";
  },
  get mailFromName(): string {
    return process.env.MAIL_FROM_NAME?.trim() || "MTN Foundation Scholarship";
  },
  get supportEmail(): string {
    return process.env.SUPPORT_EMAIL?.trim() || this.mailFromAddress;
  },
  /**
   * Local development only: print emails to the terminal (and show OTP codes on screen) instead of
   * sending. On when MAIL_DRY_RUN=true, or when no ZeptoMail token is set. Always off in production.
   */
  get mailDryRun(): boolean {
    return !isProd && (process.env.MAIL_DRY_RUN?.trim().toLowerCase() === "true" || !this.zeptoToken);
  },
  isProd,
};
