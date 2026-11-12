import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/auth";
import { getVotingStatus } from "@/lib/voting";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" } };

const LABELS = { open: "Voting open", scheduled: "Not yet open", paused: "Voting paused", closed: "Voting closed" };

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  const status = await getVotingStatus();
  return (
    <AdminShell admin={admin} status={{ tone: status.state, label: LABELS[status.state] }}>
      {children}
    </AdminShell>
  );
}
