import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { LoginCard } from "@/components/voter/login-card";
import { TIMEZONE_LABEL } from "@/lib/constants";
import { getVoter } from "@/lib/auth";
import { getVotingStatus } from "@/lib/voting";
import { formatShortDay, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const voter = await getVoter();
  if (voter) redirect(voter.vote ? "/vote/done" : "/vote");

  const status = await getVotingStatus();
  const open = status.state === "open";

  const statusPill = {
    open: { label: "Voting is open", dot: "bg-emerald-500", ring: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
    scheduled: { label: "Opening soon", dot: "bg-amber-500", ring: "bg-amber-50 text-amber-800 ring-amber-200" },
    paused: { label: "Voting paused", dot: "bg-amber-500", ring: "bg-amber-50 text-amber-800 ring-amber-200" },
    closed: { label: "Voting has closed", dot: "bg-zinc-400", ring: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  }[status.state];

  const dates = [
    { label: "Voting opens", at: status.opensAt },
    { label: "Voting closes", at: status.closesAt },
  ];

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_15%_0%,rgba(143,29,34,0.07),transparent_70%)]"
          />
          {/*
            Mobile: title → sign-in card → dates (the form is reachable without scrolling).
            Desktop: title + dates on the left, sign-in card on the right.
          */}
          <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-12 sm:pb-16 md:grid-cols-[1.1fr_1fr] md:items-center md:py-16 lg:py-20">
            <div className="animate-slide-up md:col-start-1 md:row-start-1 md:self-end">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                  statusPill.ring,
                )}
              >
                <span className={cn("size-1.5 rounded-full", statusPill.dot, open && "animate-pulse")} />
                {statusPill.label}
              </span>
              <h1 className="mt-4 text-[1.75rem] leading-[1.12] font-bold tracking-tight text-balance min-[380px]:text-[2rem] sm:mt-5 sm:text-[2.6rem] md:text-4xl lg:text-5xl xl:text-[3.25rem]">
                Scholars&apos; Choice <span className="text-brand-600">Vice&#8209;Chancellor</span> Award
              </h1>
              <p className="mt-3 hidden max-w-xl text-[15px] leading-relaxed text-zinc-600 sm:mt-4 sm:block sm:text-lg md:text-base lg:text-lg">
                Recognising the Vice-Chancellor who has shown the greatest commitment to students&apos; welfare,
                learning and wellbeing — chosen by you, the MTN Scholars.
              </p>
            </div>

            <div className="animate-slide-up [animation-delay:80ms] md:col-start-2 md:row-span-2 md:row-start-1">
              <div className="mx-auto w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.18)] min-[400px]:p-6 sm:p-8 md:max-w-none">
                <LoginCard votingOpen={open} closedMessage={status.message} />
              </div>
            </div>

            <div className="animate-slide-up [animation-delay:120ms] md:col-start-1 md:row-start-2 md:self-start">
              <dl className="grid max-w-xl grid-cols-2 gap-3">
                {dates.map(({ label, at }) => (
                  <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-3.5 sm:p-4">
                    <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                      <CalendarClock className="size-3.5 shrink-0" /> {label}
                    </dt>
                    <dd className="mt-1 font-semibold">{formatShortDay(at)}</dd>
                    <dd className="text-sm text-zinc-500">
                      {formatTime(at)} {TIMEZONE_LABEL}
                    </dd>
                  </div>
                ))}
              </dl>

            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
