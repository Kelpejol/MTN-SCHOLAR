import { LogOut } from "lucide-react";
import { SiteHeader } from "@/components/brand";
import { signOutVoter } from "@/app/actions/voter";

export function VoterHeader({ name, matric }: { name: string; matric: string }) {
  return (
    <SiteHeader
      right={
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden text-right leading-tight md:block">
            <p className="max-w-[16rem] truncate text-sm font-medium">{name}</p>
            <p className="font-mono text-xs text-zinc-500">{matric}</p>
          </div>
          <form action={signOutVoter}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:text-ink"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      }
    />
  );
}
