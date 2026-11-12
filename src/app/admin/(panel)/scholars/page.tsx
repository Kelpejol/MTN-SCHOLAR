import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/shell";
import { FilterTabs, Pagination, SearchBox } from "@/components/admin/list-controls";
import { ScholarsHeaderActions, ScholarsTable, type ScholarRow } from "@/components/admin/scholars";
import { Card } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import { normalizeMatric } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scholars" };

export default async function ScholarsPage({ searchParams }: PageProps<"/admin/scholars">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const status = sp.status === "voted" || sp.status === "pending" ? sp.status : "all";
  const requestedPage = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);

  const search: Prisma.ScholarWhereInput = q
    ? {
        OR: [
          { fullName: { contains: q } },
          { email: { contains: q } },
          { matricNumber: { contains: normalizeMatric(q) } },
        ],
      }
    : {};
  const statusFilter: Prisma.ScholarWhereInput =
    status === "voted" ? { vote: { isNot: null } } : status === "pending" ? { vote: { is: null } } : {};
  const where: Prisma.ScholarWhereInput = { AND: [search, statusFilter] };

  const [allCount, votedCount, filteredTotal] = await Promise.all([
    prisma.scholar.count({ where: search }),
    prisma.scholar.count({ where: { AND: [search, { vote: { isNot: null } }] } }),
    prisma.scholar.count({ where }),
  ]);
  const pendingTotal = await prisma.scholar.count({ where: { vote: { is: null } } });
  const pageCount = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const scholars = await prisma.scholar.findMany({
    where,
    orderBy: status === "voted" ? [{ vote: { createdAt: "desc" } }] : [{ fullName: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      fullName: true,
      matricDisplay: true,
      email: true,
      reminderCount: true,
      lastRemindedAt: true,
      vote: { select: { createdAt: true, vcName: true, institution: { select: { name: true } } } },
    },
  });

  const rows: ScholarRow[] = scholars.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    matric: s.matricDisplay,
    email: s.email,
    voted: !!s.vote,
    votedAt: s.vote ? formatDateTime(s.vote.createdAt) : null,
    institution: s.vote?.institution.name ?? null,
    vcName: s.vote?.vcName ?? null,
    reminderCount: s.reminderCount,
    lastRemindedAt: s.lastRemindedAt ? formatDateTime(s.lastRemindedAt) : null,
  }));

  return (
    <>
      <PageHeader
        title="Scholars"
        description="Scholar details uploaded by admins. Matric numbers are matched ignoring spaces and letter case."
        actions={<ScholarsHeaderActions pendingTotal={pendingTotal} />}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          param="status"
          options={[
            { value: "all", label: "All", count: allCount },
            { value: "voted", label: "Voted", count: votedCount },
            { value: "pending", label: "Not voted", count: allCount - votedCount },
          ]}
        />
        <SearchBox placeholder="Search name, matric or email" />
      </div>
      <Card className="overflow-hidden">
        <ScholarsTable rows={rows} pendingTotal={pendingTotal} hasFilters={!!q || status !== "all"} />
        <Pagination page={page} pageCount={pageCount} total={filteredTotal} pageSize={PAGE_SIZE} />
      </Card>
    </>
  );
}
