import { TIMEZONE, TIMEZONE_LABEL, WAT_OFFSET } from "./constants";

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const longDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDayFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function tidy(s: string) {
  // Normalise narrow/no-break spaces some ICU builds emit, and upper-case am/pm.
  return s.replace(/[  ]/g, " ").replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());
}

/** "13 Nov 2026, 9:05 AM" (WAT) */
export function formatDateTime(date: Date | string | null | undefined, withZone = false): string {
  if (!date) return "";
  const s = tidy(dateTimeFmt.format(new Date(date)));
  return withZone ? `${s} ${TIMEZONE_LABEL}` : s;
}

/** "Friday, 13 November 2026" */
export function formatLongDate(date: Date | string): string {
  return tidy(longDateFmt.format(new Date(date)));
}

/** "Fri, 13 Nov" */
export function formatShortDay(date: Date | string): string {
  return tidy(shortDayFmt.format(new Date(date)));
}

/** "9:05 AM" */
export function formatTime(date: Date | string): string {
  return tidy(timeFmt.format(new Date(date)));
}

/** "Friday, 13 November 2026 at 12:00 AM WAT" */
export function formatFullMoment(date: Date | string): string {
  return `${formatLongDate(date)} at ${formatTime(date)} ${TIMEZONE_LABEL}`;
}

/** Date -> value for <input type="datetime-local"> expressed in WAT. */
export function toWatInputValue(date: Date | string): string {
  const d = new Date(date);
  return new Date(d.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** "2026-11-13T09:00" (interpreted as WAT) -> Date. Returns null if invalid. */
export function fromWatInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${WAT_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Use the same WAT validation in Settings and its server action. */
export function validateVotingWindow(input: { opensAt: string; closesAt: string }):
  | { ok: true; opensAt: Date; closesAt: Date }
  | { ok: false; error: string } {
  const opensAt = fromWatInputValue(input.opensAt);
  const closesAt = fromWatInputValue(input.closesAt);
  if (!opensAt || !closesAt) return { ok: false, error: "Enter valid dates and times." };
  if (closesAt <= opensAt) return { ok: false, error: "Closing time must be after opening time." };
  return { ok: true, opensAt, closesAt };
}

/** "20261113-0905" — used in export filenames. */
export function fileStamp(date = new Date()): string {
  return toWatInputValue(date).replace(/[-:]/g, "").replace("T", "-");
}
