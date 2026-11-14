import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Download, Vote } from "lucide-react";
import { PageHeader } from "@/components/admin/shell";
import { Pagination, SearchBox, SelectFilter } from "@/components/admin/list-controls";
import { Card, EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { PAGE_SIZE, UNASSIGNED_REGION } from "@/lib/constants";
import { sortRegions } from "@/lib/results";
import { formatDateTime } from "@/lib/time";
import { formatNumber, normalizeMatric } from "@/lib/utils";
import { DownloadLink } from "@/components/ui/download-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votes" };

export default async function VotesPage({ searchParams }: PageProps<"/admin/votes">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const region = typeof sp.region === "string" ? sp.region : "";
  const institution = typeof sp.institution === "string" ? sp.institution : "";
  const requestedPage = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const where: Prisma.VoteWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { scholar: { fullName: { contains: q } } },
              { scholar: { email: { contains: q } } },
              { scholar: { matricNumber: { contains: normalizeMatric(q) } } },
              { vcName: { contains: q } },
            ],
          }
        : {},
      region
        ? { institution: { ceremonyRegion: region === UNASSIGNED_REGION ? null : region } }
        : {},
      institution ? { institutionId: institution } : {},
    ],
  };

  const [total, regionRows, institutions] = await Promise.all([
    prisma.vote.count({ where }),
    prisma.institution.findMany({ distinct: ["ceremonyRegion"], select: { ceremonyRegion: true } }),
    prisma.institution.findMany({
      where: { votes: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const votes = await prisma.vote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      createdAt: true,
      vcName: true,
      scholar: { select: { fullName: true, matricDisplay: true, email: true } },
      institution: { select: { name: true, ceremonyRegion: true } },
    },
  });
  const regions = sortRegions(regionRows.map((r) => r.ceremonyRegion ?? UNASSIGNED_REGION));

  return (
    <>
      <PageHeader
        title="Votes"
        description={`${formatNumber(total)} ${total === 1 ? "vote" : "votes"}${q || region || institution ? (total === 1 ? " matches your filters" : " match your filters") : " recorded"}. Each matric number can vote once.`}
        actions={
          <DownloadLink href="/api/admin/export/votes" variant="primary">
            <Download className="size-4" /> Export all votes
          </DownloadLink>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <SelectFilter param="region" label="All regions" options={regions.map((r) => ({ value: r, label: r }))} />
          <SelectFilter
            param="institution"
            label="All institutions"
            options={institutions.map((i) => ({ value: i.id, label: i.name }))}
          />
        </div>
        <SearchBox placeholder="Search scholar, matric or VC name" />
      </div>
      <Card className="overflow-hidden">
        {votes.length === 0 ? (
          <EmptyState icon={<Vote className="size-5" />} title={total === 0 && !q ? "No votes yet" : "No matching votes"}>
            {total === 0 && !q ? "Votes will appear here as scholars submit them." : "Try a different filter."}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100 md:hidden">
              {votes.map((v) => (
                <li key={v.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium break-words">{v.scholar.fullName}</p>
                    <p className="shrink-0 text-xs text-zinc-500">{formatDateTime(v.createdAt)}</p>
                  </div>
                  <p className="mt-0.5 font-mono text-xs break-all text-zinc-500">{v.scholar.matricDisplay}</p>
                  <p className="mt-2 font-medium">{v.institution.name}</p>
                  <p className="text-xs text-zinc-500">
                    {v.institution.ceremonyRegion ?? UNASSIGNED_REGION} · VC: {v.vcName}
                  </p>
                </li>
              ))}
            </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Time (WAT)</th>
                  <th className="px-4 py-3 font-medium">Scholar</th>
                  <th className="px-4 py-3 font-medium">Matric number</th>
                  <th className="px-4 py-3 font-medium">Institution</th>
                  <th className="px-4 py-3 font-medium">Region</th>
                  <th className="px-4 py-3 font-medium">VC name (as entered)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {votes.map((v) => (
                  <tr key={v.id} className="align-top hover:bg-zinc-50/60">
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-zinc-600">{formatDateTime(v.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{v.scholar.fullName}</p>
                      <p className="text-xs text-zinc-500">{v.scholar.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{v.scholar.matricDisplay}</td>
                    <td className="px-4 py-3 font-medium">{v.institution.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{v.institution.ceremonyRegion ?? UNASSIGNED_REGION}</td>
                    <td className="max-w-64 px-4 py-3 break-words">{v.vcName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
