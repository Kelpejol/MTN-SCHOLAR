/* eslint-disable @next/next/no-img-element -- logos have unknown intrinsic sizes; sized by height */
import Link from "next/link";
import { BRAND } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** "powered by [Dragnet mark] Dragnet" */
export function PoweredBy({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:text-xs", tone === "dark" ? "text-zinc-400" : "text-zinc-500", className)}>
      powered by
      <img src={BRAND.dragnetMark} alt="" className="h-3.5 w-auto sm:h-4" />
      <span className={cn("font-semibold tracking-tight", tone === "dark" ? "text-white" : "text-ink")}>{BRAND.poweredBy}</span>
    </span>
  );
}

/** MTN badge + programme name + "powered by Dragnet". */
export function BrandLockup({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 sm:gap-3.5", className)}>
      <img
        src={BRAND.mtnLogo}
        alt="MTN"
        className={cn("w-auto shrink-0 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.12)]", compact ? "h-9" : "h-10 sm:h-11")}
      />
      <div className="min-w-0 leading-tight">
        <p className={cn("font-semibold tracking-tight text-ink", compact ? "text-[13px] leading-snug" : "text-[13px] sm:text-[15px]")}>
          {BRAND.programName}
        </p>
        <p className="mt-0.5">
          <PoweredBy />
        </p>
      </div>
    </div>
  );
}

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 [@media(max-height:480px)]:static border-b border-zinc-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6">
        <Link href="/" className="min-w-0 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/10">
          <BrandLockup />
        </Link>
        {right}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} {BRAND.programName}. All rights reserved.
        </p>
        <div className="flex items-center gap-2.5 text-xs text-zinc-500">
          Powered by
          <img src={BRAND.dragnetLogo} alt={BRAND.poweredByFull} className="h-9 w-auto" />
        </div>
      </div>
    </footer>
  );
}
