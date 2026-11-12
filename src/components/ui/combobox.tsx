"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboboxOption = { value: string; label: string; hint?: string | null };

function fold(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`.,]/g, "");
}

type Props = {
  id?: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  sheetTitle?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
};

/**
 * Searchable single-select. Desktop: dropdown under the trigger. Phones: full-screen sheet,
 * so the list stays usable with the on-screen keyboard open.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  sheetTitle = "Select",
  invalid,
  describedBy,
  disabled,
}: Props) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Phones get a full-screen sheet rendered in a portal (so no ancestor stacking context or
  // transform can trap it); larger screens get an inline dropdown.
  const [asSheet, setAsSheet] = useState(false);

  const selected = options.find((o) => o.value === value) ?? null;

  const indexed = useMemo(
    () => options.map((o) => ({ option: o, haystack: fold(`${o.label} ${o.hint ?? ""}`) })),
    [options],
  );
  const filtered = useMemo(() => {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return indexed.filter(({ haystack }) => terms.every((t) => haystack.includes(t))).map((x) => x.option);
  }, [query, indexed, options]);

  function openList() {
    if (disabled) return;
    setQuery("");
    const idx = selected ? options.findIndex((o) => o.value === selected.value) : 0;
    setActive(Math.max(0, idx));
    setAsSheet(window.matchMedia("(max-width: 639px)").matches);
    setOpen(true);
  }

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    close();
  }

  // Focus search on open; lock page scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
    if (!asSheet) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open, asSheet]);

  // Close when clicking outside (desktop dropdown).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Keep the active option in view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(filtered.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const panel = (
        <div
          ref={panelRef}
          className={cn(
            "flex flex-col bg-white",
            asSheet
              ? "fixed inset-0 z-[100] h-dvh"
              : "absolute left-0 right-0 top-full z-50 mt-2 max-h-[22rem] rounded-xl border border-zinc-200 shadow-xl",
          )}
        >
          {asSheet && (
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <p className="font-semibold">{sheetTitle}</p>
            <button
              type="button"
              onClick={() => close()}
              className="grid size-10 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          )}
          <div className={cn("border-b border-zinc-100", asSheet ? "p-3" : "p-2")}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchRef}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={filtered[active] ? `${baseId}-opt-${active}` : undefined}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
                placeholder={searchPlaceholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={cn("w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 outline-none focus:border-zinc-400 focus:bg-white", asSheet ? "h-11 text-base" : "h-10 text-sm")}
              />
            </div>
          </div>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={sheetTitle}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-zinc-500">No matches for “{query}”.</li>
            )}
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${baseId}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-3 sm:py-2.5",
                    index === active && "bg-zinc-100",
                  )}
                >
                  <span className="min-w-0">
                    <span className={cn("block text-[15px] sm:text-sm", isSelected ? "font-semibold" : "font-medium")}>
                      {option.label}
                    </span>
                    {option.hint && <span className="block truncate text-xs text-zinc-500">{option.hint}</span>}
                  </span>
                  {isSelected && <Check className="size-4 shrink-0 text-brand-600" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        className={cn(
          "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-2.5 text-left text-[15px]",
          "outline-none transition-[border-color,box-shadow] focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-zinc-900/10",
          "disabled:cursor-not-allowed disabled:bg-zinc-50",
          invalid ? "border-brand-500" : "border-zinc-300 hover:border-zinc-400",
          open && "border-ink ring-4 ring-zinc-900/10",
        )}
      >
        <span className={cn("min-w-0", !selected && "text-zinc-400")}>
          {selected ? (
            <>
              <span className="block truncate font-medium text-ink">{selected.label}</span>
              {selected.hint && <span className="block truncate text-xs text-zinc-500">{selected.hint}</span>}
            </>
          ) : (
            placeholder
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-zinc-500" aria-hidden />
      </button>

      {open && asSheet && createPortal(panel, document.body)}
      {open && !asSheet && panel}
    </div>
  );
}
