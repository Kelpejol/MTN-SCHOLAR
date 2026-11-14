import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_INSTITUTIONS } from "../prisma/data/institutions";
import { searchComboboxOptions } from "../src/lib/combobox-search";
import { validateVotingWindow } from "../src/lib/time";

const institutions = SEED_INSTITUTIONS.map((institution) => ({
  value: institution.name,
  label: institution.name,
  hint: institution.location,
}));

// These eight names selected a different institution when Enter accepted the first match.
for (const name of [
  "University of Lagos",
  "University of Nigeria",
  "University of Abuja",
  "Osun State University",
  "Ekiti State University",
  "Ebonyi State University",
  "Kaduna State University",
  "Taraba State University",
]) {
  test(`BUG-001: exact search for ${name} is the first keyboard choice`, () => {
    assert.equal(searchComboboxOptions(institutions, name)[0]?.value, name);
  });
}

test("every seeded institution can be selected by its exact name", () => {
  for (const institution of institutions) {
    assert.equal(searchComboboxOptions(institutions, institution.label)[0]?.value, institution.value);
  }
});

test("name relevance takes precedence over broader location matches", () => {
  const options = [
    { value: "location", label: "Alpha University", hint: "Lagos" },
    { value: "contains", label: "University of Lagos" },
    { value: "prefix-z", label: "Lagos University" },
    { value: "prefix-a", label: "Lagos State University" },
    { value: "exact", label: "Lagos" },
  ];
  assert.deepEqual(searchComboboxOptions(options, "lagos").map((o) => o.value), [
    "exact", "prefix-a", "prefix-z", "contains", "location",
  ]);
  assert.equal(options[0].value, "location", "search must not reorder the caller's array");
});

test("search still supports whitespace, case, punctuation, accents and location terms", () => {
  assert.equal(searchComboboxOptions(institutions, "  UNIVERSITY   of LAGOS  ")[0]?.value, "University of Lagos");
  assert.equal(searchComboboxOptions(institutions, "Akoka Lagos")[0]?.value, "University of Lagos");
  assert.equal(searchComboboxOptions([{ value: "one", label: "St. André’s University" }], "st andres")[0]?.value, "one");
  assert.deepEqual(searchComboboxOptions(institutions, "no institution with this name"), []);
  const alphabetical = [...institutions].sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
  assert.deepEqual(searchComboboxOptions(institutions, ""), alphabetical);
});

test("BUG-007: reversed and equal voting windows give an actionable validation error", () => {
  for (const closesAt of ["2026-11-12T23:59", "2026-11-13T00:00"]) {
    assert.deepEqual(validateVotingWindow({ opensAt: "2026-11-13T00:00", closesAt }), {
      ok: false,
      error: "Closing time must be after opening time.",
    });
  }
});

test("voting window validation handles missing dates and interprets valid input as WAT", () => {
  assert.deepEqual(validateVotingWindow({ opensAt: "", closesAt: "2026-11-16T23:59" }), {
    ok: false,
    error: "Enter valid dates and times.",
  });
  const result = validateVotingWindow({ opensAt: "2026-11-13T00:00", closesAt: "2026-11-16T23:59" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.opensAt.toISOString(), "2026-11-12T23:00:00.000Z");
    assert.equal(result.closesAt.toISOString(), "2026-11-16T22:59:00.000Z");
  }
});
