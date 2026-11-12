import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Collapse runs of whitespace and trim. */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

/** Canonical matric number: all whitespace removed, upper-cased. Used for storage and login. */
export function normalizeMatric(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, "").toUpperCase();
}

export function normalizeEmail(value: unknown): string {
  return cleanText(value).toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/** "adebola@gmail.com" -> "ad•••••@gmail.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(3, Math.min(local.length - visible.length, 8)))}@${domain}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString("en-NG")} ${count === 1 ? singular : plural}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-NG");
}

export function percent(part: number, total: number, digits = 1): string {
  if (!total) return "0%";
  return `${((part / total) * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}
