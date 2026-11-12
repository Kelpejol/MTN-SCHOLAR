import type { Metadata } from "next";
import { Crown, Download } from "lucide-react";
import { PageHeader } from "@/components/admin/shell";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { getResults } from "@/lib/results";
import { getVotingStatus } from "@/lib/voting";
import { formatDateTime } from "@/lib/time";
import { cn, formatNumber, percent, pluralize } from "@/lib/utils";
import { DownloadLink } from "@/components/ui/download-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage() {
  const [{ regions, totalVotes }, status] = await Promise.all([getResults(), getVotingStatus()]);
  const final = status.state === "closed";

  return (
    <>
      <PageHeader
        title="Results"
        description={
          <>
            Votes are counted by institution only. {pluralize(totalVotes, "vote")} in total ·{" "}
            {final ? "Final results" : `Live as of ${formatDateTime(new Date(), true)}`}
          </>
        }
        actions={
          <>
            <DownloadLink href="/api/admin/export/results" variant="primary">
              <Download className="size-4" /> Results CSV
            </DownloadLink>
            <DownloadLink href="/api/admin/export/vc-names" variant="secondary">
              <Download className="size-4" /> VC names CSV
            </DownloadLink>
            <DownloadLink href="/api/admin/export/votes" variant="secondary">
              <Download className="size-4" /> All votes CSV
            </DownloadLink>
          </>
        }
      />

      {regions.length > 1 && (
        <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Regions">
          {regions.map((r) => (
            <a
              key={r.region}
              href={`#region-${r.region.replace(/\s+/g, "-")}`}
              className="shrink-0 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:text-ink"
            >
              {r.region} <span className="text-zinc-400 tabular-nums">· {formatNumber(r.totalVotes)}</span>
            </a>
          ))}
        </nav>
      )}

      {regions.length === 0 ? (
        <Card>
          <EmptyState title="No results yet">Add institutions and open voting to see results.</EmptyState>
        </Card>
      ) : (
        <div className="space-y-8">
          {regions.map((region) => (
            <section key={region.region} id={`region-${region.region.replace(/\s+/g, "-")}`} className="scroll-mt-20">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-[0.12em] text-brand-600 uppercase">Ceremony region</p>
                  <h2 className="text-xl font-bold tracking-tight">{region.region}</h2>
                </div>
                <p className="text-sm text-zinc-500">
                  {pluralize(region.totalVotes, "vote")} · {pluralize(region.institutions.length, "institution")}
                </p>
              </div>

              {region.leaders.length > 0 && (
                <div className="mb-3 flex items-center gap-4 rounded-2xl bg-ink p-4 text-white sm:p-5">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-600">
                    <Crown className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-400">
                      {region.leaders.length > 1
                        ? `Tied for first (${region.leaders.length} institutions)`
                        : final
                          ? "Winner"
                          : "Currently leading"}
                    </p>
                    <p className="font-semibold text-balance sm:text-lg">
                      {region.leaders.map((l) => l.name).join(" · ")}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {pluralize(region.leaders[0].votes, "vote")} · {percent(region.leaders[0].votes, region.totalVotes)} of
                      region
                    </p>
                  </div>
                </div>
              )}

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                      <tr>
                        <th className="w-12 px-3 py-3 font-medium sm:w-14 sm:px-4">Rank</th>
                        <th className="px-4 py-3 font-medium">Institution</th>
                        <th className="hidden w-[38%] px-4 py-3 font-medium sm:table-cell">Share</th>
                        <th className="w-20 px-4 py-3 text-right font-medium">Votes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {region.institutions.map((inst) => (
                        <tr key={inst.id} className={cn(inst.isLeader && "bg-brand-50/40")}>
                          <td className="px-3 py-3 font-semibold text-zinc-500 tabular-nums sm:px-4">{inst.rank}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{inst.name}</span>
                              {inst.isLeader && (
                                <Badge tone="brand">{region.leaders.length > 1 ? "Tied" : final ? "Winner" : "Leading"}</Badge>
                              )}
                              {!inst.isActive && <Badge>Hidden from ballot</Badge>}
                            </div>
                            {inst.location && <p className="text-xs text-zinc-500">{inst.location}</p>}
                          </td>
                          <td className="hidden px-4 py-3 sm:table-cell">
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                                <div
                                  className={cn("h-full rounded-full", inst.isLeader ? "bg-brand-600" : "bg-zinc-400")}
                                  style={{ width: `${inst.share * 100}%` }}
                                />
                              </div>
                              <span className="w-12 text-right text-xs text-zinc-500 tabular-nums">
                                {percent(inst.votes, region.totalVotes)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(inst.votes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
