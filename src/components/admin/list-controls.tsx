"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatNumber } from "@/lib/utils";

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in changes)) next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }
  return { update, pending, params };
}

export function SearchBox({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const { update, pending, params } = useQueryUpdater();
  const [value, setValue] = useState(params.get(param) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ [param]: value.trim() || null }), 300);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-9 text-sm outline-none placeholder:text-zinc-400 focus:border-ink focus:ring-4 focus:ring-zinc-900/10 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <Spinner className="size-4 text-zinc-400" />
        ) : (
          value && (
            <button type="button" onClick={() => setValue("")} aria-label="Clear search" className="text-zinc-400 hover:text-ink">
              <X className="size-4" />
            </button>
          )
        )}
      </span>
    </div>
  );
}

export function FilterTabs({
  param,
  options,
}: {
  param: string;
  options: { value: string; label: string; count?: number }[];
}) {
  const { update, params } = useQueryUpdater();
  const current = params.get(param) ?? options[0]?.value ?? "";
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1" role="tablist">
      {options.map((o) => {
        const active = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => update({ [param]: o.value === options[0].value ? null : o.value })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-ink text-white" : "text-zinc-600 hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("text-xs tabular-nums", active ? "text-zinc-300" : "text-zinc-400")}>
                {formatNumber(o.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SelectFilter({
  param,
  label,
  options,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { update, params } = useQueryUpdater();
  return (
    <select
      aria-label={label}
      value={params.get(param) ?? ""}
      onChange={(e) => update({ [param]: e.target.value || null })}
      className="h-10 max-w-full rounded-xl border border-zinc-300 bg-white px-3 pr-8 text-sm outline-none focus:border-ink focus:ring-4 focus:ring-zinc-900/10"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Pagination({ page, pageCount, total, pageSize }: { page: number; pageCount: number; total: number; pageSize: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (total === 0) return null;
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const link = "grid size-9 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50";
  const disabled = "pointer-events-none opacity-40";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-sm">
      <p className="text-zinc-500 tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Link href={href(page - 1)} aria-label="Previous page" className={cn(link, page <= 1 && disabled)} scroll={false}>
          <ChevronLeft className="size-4" />
        </Link>
        <span className="text-zinc-500 tabular-nums">
          {page} / {pageCount}
        </span>
        <Link href={href(page + 1)} aria-label="Next page" className={cn(link, page >= pageCount && disabled)} scroll={false}>
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
