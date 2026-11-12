import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Download, Trophy, Users, Vote } from "lucide-react";
import { PageHeader } from "@/components/admin/shell";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getResults } from "@/lib/results";
import { getVotingStatus } from "@/lib/voting";
import { formatDateTime, formatFullMoment, formatShortDay, toWatInputValue } from "@/lib/time";
import { formatNumber, percent, pluralize } from "@/lib/utils";
import { DownloadLink } from "@/components/ui/download-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const [scholarCount, voteCount, status, results, recent, voteTimes] = await Promise.all([
    prisma.scholar.count(),
    prisma.vote.count(),
    getVotingStatus(),
    getResults(),
    prisma.vote.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        scholar: { select: { fullName: true, matricDisplay: true } },
        institution: { select: { name: true } },
      },
    }),
    prisma.vote.findMany({ select: { createdAt: true } }),
  ]);
  const notVoted = scholarCount - voteCount;

  // Votes per day (WAT) across the voting window.
  const days: { key: string; label: string; count: number }[] = [];
  for (
    let d = new Date(toWatInputValue(status.opensAt).slice(0, 10) + "T12:00:00+01:00");
    d <= status.closesAt;
    d = new Date(d.getTime() + 86_400_000)
  ) {
    days.push({ key: toWatInputValue(d).slice(0, 10), label: formatShortDay(d), count: 0 });
    if (days.length > 31) break;
  }
  for (const v of voteTimes) {
    const day = days.find((x) => x.key === toWatInputValue(v.createdAt).slice(0, 10));
    if (day) day.count++;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const stats = [
    { label: "Registered scholars", value: formatNumber(scholarCount), icon: Users, href: "/admin/scholars" },
    { label: "Votes cast", value: formatNumber(voteCount), icon: Vote, href: "/admin/votes" },
    { label: "Turnout", value: percent(voteCount, scholarCount), icon: Trophy, href: "/admin/results" },
    { label: "Yet to vote", value: formatNumber(notVoted), icon: Bell, href: "/admin/scholars?status=pending" },
  ];

  return (
    <>
      <PageHeader
        title="Overview"
        description={
          status.state === "open"
            ? `Voting is live. ${status.message}`
            : status.message
        }
        actions={
          <>
            <DownloadLink href="/api/admin/export/votes" variant="secondary">
              <Download className="size-4" /> Export votes
            </DownloadLink>
            <Link href="/admin/scholars?status=pending" className={buttonClasses("primary", "md")}>
              <Bell className="size-4" /> Send reminders
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:border-zinc-300 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 sm:text-sm">{label}</p>
                <Icon className="size-4 text-zinc-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-4 p-4 sm:p-5">
        <div className="flex items-center justify-between text-sm">
          <p className="font-medium">Turnout progress</p>
          <p className="text-zinc-500 tabular-nums">
            {formatNumber(voteCount)} / {formatNumber(scholarCount)}
          </p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: scholarCount ? `${(voteCount / scholarCount) * 100}%` : 0 }}
          />
        </div>
      </Card>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Leaders by ceremony region</h2>
        <Link href="/admin/results" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
          Full results <ArrowRight className="size-4" />
        </Link>
      </div>
      {results.regions.length === 0 ? (
        <Card className="mt-3">
          <EmptyState title="No institutions yet">Add institutions to see results here.</EmptyState>
        </Card>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.regions.map((region) => (
            <Card key={region.region} className="flex flex-col p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase">{region.region}</p>
                <Badge>{pluralize(region.totalVotes, "vote")}</Badge>
              </div>
              {region.leaders.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">No votes yet.</p>
              ) : (
                <div className="mt-3">
                  <p className="text-lg leading-snug font-semibold">
                    {region.leaders.map((l) => l.name).join(" / ")}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {region.leaders.length > 1 ? "Tied for first · " : "Leading · "}
                    {pluralize(region.leaders[0].votes, "vote")} ({percent(region.leaders[0].votes, region.totalVotes)})
                  </p>
                </div>
              )}
              <ul className="mt-4 space-y-2.5">
                {region.institutions
                  .filter((i) => i.votes > 0)
                  .slice(0, 4)
                  .map((inst) => (
                    <li key={inst.id}>
                      <div className="flex justify-between gap-3 text-xs">
                        <span className="truncate text-zinc-600">{inst.name}</span>
                        <span className="font-medium tabular-nums">{inst.votes}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className={inst.isLeader ? "h-full rounded-full bg-brand-600" : "h-full rounded-full bg-zinc-400"}
                          style={{ width: `${inst.share * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card className="p-5">
          <h2 className="font-semibold">Votes per day</h2>
          <p className="text-xs text-zinc-500">
            {formatFullMoment(status.opensAt)} → {formatFullMoment(status.closesAt)}
          </p>
          <div className="mt-6 flex h-44 items-end gap-3">
            {days.map((d) => (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-semibold tabular-nums">{d.count}</span>
                <div
                  className="w-full max-w-14 rounded-t-lg bg-ink"
                  style={{ height: `${Math.max(2, (d.count / maxDay) * 100)}%` }}
                />
                <span className="text-[11px] whitespace-nowrap text-zinc-500">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold">Latest votes</h2>
            <Link href="/admin/votes" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="No votes yet">Votes will appear here as scholars submit them.</EmptyState>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {recent.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.scholar.fullName}</p>
                    <p className="truncate text-xs text-zinc-500">
                      <span className="font-mono">{v.scholar.matricDisplay}</span> · {v.institution.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs whitespace-nowrap text-zinc-500">{formatDateTime(v.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
