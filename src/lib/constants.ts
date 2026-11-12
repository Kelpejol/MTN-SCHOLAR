// Shared constants. Safe to import from both server and client components.

export const BRAND = {
  programName: "MTN Foundation Scholarship",
  poweredBy: "Dragnet",
  poweredByFull: "Dragnet Solutions",
  awardName: "Scholars' Choice Vice-Chancellor Award",
  awardShortName: "Scholars' Choice VC Award",
  question:
    "Which Vice-Chancellor has shown the most commitment to students' welfare, learning and wellbeing?",
  /** Derived from the supplied logos (see public/brand). Originals are kept alongside. */
  mtnLogo: "/brand/mtn-badge.png",
  dragnetMark: "/brand/dragnet-mark.png",
  dragnetLogo: "/brand/dragnet-logo-clean.png",
} as const;

/** Nigeria uses West Africa Time (UTC+1) all year — no daylight saving. */
export const TIMEZONE = "Africa/Lagos";
export const TIMEZONE_LABEL = "WAT";
export const WAT_OFFSET = "+01:00";

/** Default voting window from the client brief: Friday 13 – Monday 16 November 2026. */
export const DEFAULT_OPENS_AT = "2026-11-13T00:00:00+01:00";
export const DEFAULT_CLOSES_AT = "2026-11-16T23:59:00+01:00";

export const GEOPOLITICAL_ZONES = [
  { value: "NORTH_CENTRAL", label: "North Central" },
  { value: "NORTH_EAST", label: "North East" },
  { value: "NORTH_WEST", label: "North West" },
  { value: "SOUTH_EAST", label: "South East" },
  { value: "SOUTH_SOUTH", label: "South South" },
  { value: "SOUTH_WEST", label: "South West" },
] as const;

export type GeopoliticalZoneValue = (typeof GEOPOLITICAL_ZONES)[number]["value"];

export function zoneLabel(value: string | null | undefined): string {
  return GEOPOLITICAL_ZONES.find((z) => z.value === value)?.label ?? "";
}

/**
 * Ceremony region options: all 36 states plus the FCT (stored as "Abuja", matching the
 * client's region names: Lagos, Enugu and Abuja).
 */
export const CEREMONY_REGIONS = [
  { value: "Abia", label: "Abia" },
  { value: "Abuja", label: "Abuja (FCT)" },
  { value: "Adamawa", label: "Adamawa" },
  { value: "Akwa Ibom", label: "Akwa Ibom" },
  { value: "Anambra", label: "Anambra" },
  { value: "Bauchi", label: "Bauchi" },
  { value: "Bayelsa", label: "Bayelsa" },
  { value: "Benue", label: "Benue" },
  { value: "Borno", label: "Borno" },
  { value: "Cross River", label: "Cross River" },
  { value: "Delta", label: "Delta" },
  { value: "Ebonyi", label: "Ebonyi" },
  { value: "Edo", label: "Edo" },
  { value: "Ekiti", label: "Ekiti" },
  { value: "Enugu", label: "Enugu" },
  { value: "Gombe", label: "Gombe" },
  { value: "Imo", label: "Imo" },
  { value: "Jigawa", label: "Jigawa" },
  { value: "Kaduna", label: "Kaduna" },
  { value: "Kano", label: "Kano" },
  { value: "Katsina", label: "Katsina" },
  { value: "Kebbi", label: "Kebbi" },
  { value: "Kogi", label: "Kogi" },
  { value: "Kwara", label: "Kwara" },
  { value: "Lagos", label: "Lagos" },
  { value: "Nasarawa", label: "Nasarawa" },
  { value: "Niger", label: "Niger" },
  { value: "Ogun", label: "Ogun" },
  { value: "Ondo", label: "Ondo" },
  { value: "Osun", label: "Osun" },
  { value: "Oyo", label: "Oyo" },
  { value: "Plateau", label: "Plateau" },
  { value: "Rivers", label: "Rivers" },
  { value: "Sokoto", label: "Sokoto" },
  { value: "Taraba", label: "Taraba" },
  { value: "Yobe", label: "Yobe" },
  { value: "Zamfara", label: "Zamfara" },
] as const;

export const CEREMONY_REGION_VALUES: readonly string[] = CEREMONY_REGIONS.map((r) => r.value);

/** Regions named in the client brief are always listed first, in this order. */
export const PRIMARY_REGIONS = ["Lagos", "Enugu", "Abuja"] as const;

export const UNASSIGNED_REGION = "Unassigned";

export const LIMITS = {
  nameMax: 150,
  matricMax: 50,
  emailMax: 254,
  vcNameMin: 2,
  vcNameMax: 120,
  institutionNameMax: 160,
  locationMax: 120,
  uploadMaxBytes: 5 * 1024 * 1024,
} as const;

export const OTP = {
  length: 6,
  ttlMinutes: 10,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  maxPerHourPerScholar: 6,
  /** Generous — scholars on the same campus network may share one public IP. */
  maxPer15MinPerIp: 80,
} as const;

export const PAGE_SIZE = 50;
