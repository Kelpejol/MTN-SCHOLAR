import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/shell";
import { SearchBox, SelectFilter } from "@/components/admin/list-controls";
import { InstitutionsHeaderActions, InstitutionsTable, type InstitutionRow } from "@/components/admin/institutions";
import { Card } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { UNASSIGNED_REGION } from "@/lib/constants";
import { sortRegions } from "@/lib/results";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Institutions" };

export default async function InstitutionsPage({ searchParams }: PageProps<"/admin/institutions">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const region = typeof sp.region === "string" ? sp.region : "";

  const where: Prisma.InstitutionWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q } },
              { location: { contains: q } },
            ],
          }
        : {},
      region ? { ceremonyRegion: region === UNASSIGNED_REGION ? null : region } : {},
    ],
  };

  const [institutions, regionRows, totalCount, activeCount] = await Promise.all([
    prisma.institution.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { votes: true } } },
    }),
    prisma.institution.findMany({ distinct: ["ceremonyRegion"], select: { ceremonyRegion: true } }),
    prisma.institution.count(),
    prisma.institution.count({ where: { isActive: true } }),
  ]);

  const rows: InstitutionRow[] = institutions.map((i) => ({
    id: i.id,
    name: i.name,
    location: i.location,
    geopoliticalZone: i.geopoliticalZone,
    ceremonyRegion: i.ceremonyRegion,
    isActive: i.isActive,
    votes: i._count.votes,
  }));
  const regions = sortRegions(regionRows.map((r) => r.ceremonyRegion ?? UNASSIGNED_REGION));

  return (
    <>
      <PageHeader
        title="Institutions"
        description={`${totalCount} institutions · ${activeCount} on the ballot (listed alphabetically to scholars).`}
        actions={<InstitutionsHeaderActions />}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SelectFilter param="region" label="All ceremony regions" options={regions.map((r) => ({ value: r, label: r }))} />
        <SearchBox placeholder="Search institutions" />
      </div>
      <Card className="overflow-hidden">
        <InstitutionsTable rows={rows} hasFilters={!!q || !!region} />
      </Card>
    </>
  );
}
