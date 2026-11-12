import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/admin/shell";
import { Pagination } from "@/components/admin/list-controls";
import { Card, EmptyState } from "@/components/ui/misc";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity log" };

const PAGE = 50;

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  const sp = await searchParams;
  const total = await prisma.auditLog.count();
  const pageCount = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.min(Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1), pageCount);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE,
    take: PAGE,
    include: { admin: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="Activity log" description="A record of admin actions: uploads, edits, reminders, exports and settings." />
      <Card className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState icon={<History className="size-5" />} title="No activity yet" />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm break-words">{log.summary}</p>
                  <p className="text-xs text-zinc-500">
                    {log.admin?.name ?? "System"} · <span className="font-mono">{log.action}</span>
                  </p>
                </div>
                <p className="shrink-0 text-xs whitespace-nowrap text-zinc-500">{formatDateTime(log.createdAt, true)}</p>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE} />
      </Card>
    </>
  );
}
