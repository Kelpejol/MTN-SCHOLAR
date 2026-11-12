import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, LogOut } from "lucide-react";
import { SiteFooter } from "@/components/brand";
import { VoterHeader } from "@/components/voter/voter-header";
import { BRAND } from "@/lib/constants";
import { requireVoter } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { signOutVoter } from "@/app/actions/voter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vote recorded" };

export default async function VoteDonePage() {
  const voter = await requireVoter();
  if (!voter.vote) redirect("/vote");
  const firstName = voter.fullName.split(" ")[0] || "Scholar";
  const { vote } = voter;

  return (
    <>
      <VoterHeader name={voter.fullName} matric={voter.matricDisplay} />
      <main className="flex-1 bg-zinc-50/60">
        <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">
          <div className="animate-slide-up text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-600 text-white shadow-[0_12px_30px_-10px_rgba(143,29,34,0.6)]">
              <Check className="size-8" strokeWidth={2.5} />
            </div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Thank you, {firstName}!</h1>
            <p className="mt-2 text-zinc-600">
              Your vote for the {BRAND.awardName} has been recorded.
            </p>
          </div>

          <div className="mt-8 animate-slide-up overflow-hidden rounded-3xl border border-zinc-200 bg-white [animation-delay:80ms]">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 sm:px-6">
              <p className="text-sm font-semibold">Vote receipt</p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
                Recorded
              </span>
            </div>
            <dl className="divide-y divide-zinc-100 text-sm">
              {[
                ["Name", voter.fullName],
                ["Matric number", voter.matricDisplay],
                ["Institution", vote.institution.name],
                ["Vice-Chancellor (as entered)", vote.vcName],
                ["Submitted", formatDateTime(vote.createdAt, true)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5 px-5 py-3.5 sm:flex-row sm:justify-between sm:gap-6 sm:px-6">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="font-medium break-words sm:text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <p className="mt-5 text-center text-sm text-zinc-500">
            A copy of this receipt has been sent to your email. Votes are final and cannot be changed.
          </p>

          <form action={signOutVoter} className="mt-8 flex justify-center">
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
