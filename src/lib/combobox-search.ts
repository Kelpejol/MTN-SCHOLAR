export type ComboboxOption = { value: string; label: string; hint?: string | null };

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep exact names ahead of broader name/location matches, including when selecting with Enter. */
export function searchComboboxOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const needle = fold(query);
  const terms = needle.split(" ").filter(Boolean);
  return options
    .map((option) => {
      const label = fold(option.label);
      const haystack = `${label} ${fold(option.hint ?? "")}`;
      const rank = !needle || label === needle ? 0 : label.startsWith(needle) ? 1 : label.includes(needle) ? 2 : 3;
      return { option, rank, matches: terms.every((term) => haystack.includes(term)) };
    })
    .filter(({ matches }) => matches)
    .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label, "en", { sensitivity: "base" }))
    .map(({ option }) => option);
}
