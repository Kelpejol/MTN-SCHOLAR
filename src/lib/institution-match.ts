// Duplicate detection for institution names, built on fuzzball (a JS port of fuzzywuzzy).
//
// There is deliberately NO per-institution data in this file: every check is a generic rule,
// so it keeps working as admins add institutions. Used by the admin UI (live hints), the
// server actions (authoritative check) and the seed script.
import { ratio, token_set_ratio, token_sort_ratio } from "fuzzball";

/** Generic spelling variants only — never institution names. */
const ABBREVIATIONS: Record<string, string> = {
  univ: "university",
  uni: "university",
  fed: "federal",
  tech: "technology",
  sci: "science",
  sciences: "science",
  agric: "agriculture",
  inst: "institute",
  poly: "polytechnic",
  coll: "college",
  educ: "education",
  intl: "international",
  natl: "national",
};

const STOPWORDS = new Set(["of", "and", "the", "for", "in", "at"]);

/** Words shared by many institutions; ignored when judging whether two names are the "same place". */
const GENERIC_WORDS = new Set([
  ...STOPWORDS,
  "university",
  "state",
  "federal",
  "technology",
  "science",
  "institute",
  "polytechnic",
  "college",
  "education",
  "agriculture",
  "medical",
  "school",
  "city",
]);

function tokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t);
}

/** Canonical form stored in `Institution.normalizedName` (unique) — blocks exact duplicates. */
export function normalizeInstitutionName(name: string): string {
  const t = tokens(name);
  if (t[0] === "the") t.shift();
  return t.join(" ");
}

function distinctive(name: string): string {
  return tokens(name)
    .filter((t) => !GENERIC_WORDS.has(t))
    .join(" ");
}

function withoutStopwords(normalized: string): string {
  return normalized
    .split(" ")
    .filter((t) => !STOPWORDS.has(t))
    .join(" ");
}

/** "Federal University of Technology, Akure" -> "FUTA" */
function initials(name: string): string {
  return tokens(name)
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => t[0])
    .join("")
    .toUpperCase();
}

export type MatchKind = "exact" | "same-words" | "acronym" | "similar";

export type InstitutionMatch = {
  id: string;
  name: string;
  kind: MatchKind;
  /** 0–100 */
  score: number;
  reason: string;
};

export type ExistingInstitution = { id: string; name: string; normalizedName?: string };

const FUZZ = { full_process: false } as const; // we normalise ourselves

/**
 * Finds existing institutions that look like `candidate`, strongest first.
 * `exact` matches must be blocked; everything else is a warning an admin can override.
 */
export function findSimilarInstitutions(
  candidate: string,
  existing: ExistingInstitution[],
  { excludeId, limit = 5 }: { excludeId?: string; limit?: number } = {},
): InstitutionMatch[] {
  const norm = normalizeInstitutionName(candidate);
  if (norm.length < 2) return [];
  const candDistinct = distinctive(candidate);
  const trimmed = candidate.trim();
  const acronym = /^[A-Za-z.]{2,10}$/.test(trimmed) ? trimmed.replace(/\./g, "").toUpperCase() : null;

  const matches: InstitutionMatch[] = [];
  for (const inst of existing) {
    if (inst.id === excludeId) continue;
    const other = inst.normalizedName ?? normalizeInstitutionName(inst.name);

    if (other === norm) {
      matches.push({ id: inst.id, name: inst.name, kind: "exact", score: 100, reason: "Same name" });
      continue;
    }
    if (token_sort_ratio(withoutStopwords(norm), withoutStopwords(other), FUZZ) === 100) {
      matches.push({ id: inst.id, name: inst.name, kind: "same-words", score: 98, reason: "Same words in a different order" });
      continue;
    }
    if (acronym && acronym.length >= 2 && initials(inst.name) === acronym) {
      matches.push({ id: inst.id, name: inst.name, kind: "acronym", score: 95, reason: `Initials spell "${acronym}"` });
      continue;
    }

    const overall = ratio(norm, other, FUZZ); // typos
    const overlap = token_set_ratio(norm, other, FUZZ); // extra / missing words
    const otherDistinct = distinctive(inst.name);
    let flagged: boolean;
    let score: number;
    if (candDistinct && otherDistinct) {
      // Compare the identifying words (places, proper names) so "Kogi State University"
      // isn't confused with "Ekiti State University" just because they share boilerplate.
      const distinctScore = token_set_ratio(candDistinct, otherDistinct, FUZZ);
      score = Math.min(99, Math.round((distinctScore + overall + overlap) / 3));
      flagged = overall >= 95 || (distinctScore >= 85 && Math.max(overall, overlap) >= 75);
    } else {
      score = Math.min(99, Math.round((overall + overlap) / 2));
      flagged = Math.max(overall, overlap) >= 90;
    }
    if (flagged) {
      matches.push({
        id: inst.id,
        name: inst.name,
        kind: "similar",
        score,
        reason: overall >= 93 ? "Nearly identical spelling" : "Very similar name",
      });
    }
  }
  const rank: Record<MatchKind, number> = { exact: 0, "same-words": 1, acronym: 2, similar: 3 };
  return matches.sort((a, b) => rank[a.kind] - rank[b.kind] || b.score - a.score).slice(0, limit);
}
