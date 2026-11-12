"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Trophy,
  Users,
  Vote,
  X,
} from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/app/actions/admin";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/results", label: "Results", icon: Trophy },
  { href: "/admin/scholars", label: "Scholars", icon: Users },
  { href: "/admin/votes", label: "Votes", icon: Vote },
  { href: "/admin/reminders", label: "Reminders", icon: Bell },
  { href: "/admin/institutions", label: "Institutions", icon: Building2 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/activity", label: "Activity log", icon: History },
];

type StatusInfo = { label: string; tone: "open" | "scheduled" | "closed" | "paused" };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-ink text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-ink",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-brand-300" : "text-zinc-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function StatusBadge({ status }: { status: StatusInfo }) {
  const tone = {
    open: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    scheduled: "bg-amber-50 text-amber-800 ring-amber-200",
    paused: "bg-amber-50 text-amber-800 ring-amber-200",
    closed: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  }[status.tone];
  const dot = { open: "bg-emerald-500", scheduled: "bg-amber-500", paused: "bg-amber-500", closed: "bg-zinc-400" }[
    status.tone
  ];
  return (
    <Link
      href="/admin/settings"
      className={cn("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", tone)}
    >
      <span className={cn("size-1.5 rounded-full", dot, status.tone === "open" && "animate-pulse")} />
      {status.label}
    </Link>
  );
}

function AccountBlock({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-zinc-500">{email}</p>
      </div>
      <form action={adminLogout}>
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-brand-700"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AdminShell({
  admin,
  status,
  children,
}: {
  admin: { name: string; email: string };
  status: StatusInfo;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = NAV.find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href)));

  return (
    <div className="min-h-dvh bg-zinc-50/70 lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-zinc-200 bg-white px-4 py-5 lg:flex">
        <Link href="/admin" className="px-1">
          <BrandLockup compact />
        </Link>
        <div className="mt-6 px-1">
          <StatusBadge status={status} />
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <AccountBlock name={admin.name} email={admin.email} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-ml-2 grid size-10 place-items-center rounded-lg text-zinc-700 hover:bg-zinc-100"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          <BarChart3 className="size-4 text-brand-600" /> {current?.label ?? "Admin"}
        </p>
        <StatusBadge status={status} />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs animate-slide-up flex-col bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between">
              <BrandLockup compact />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-10 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-6 flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <AccountBlock name={admin.name} email={admin.email} />
          </div>
        </div>
      )}

      <main className="min-w-0">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {description && <div className="mt-1 text-sm text-zinc-500">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 xl:shrink-0 xl:justify-end">{actions}</div>}
    </div>
  );
}
