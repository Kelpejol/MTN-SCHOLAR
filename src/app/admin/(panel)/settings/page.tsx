import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/shell";
import { AdminsCard, EmailCard, PasswordCard, VotingWindowCard } from "@/components/admin/settings";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { computeVotingStatus, getVotingConfig } from "@/lib/voting";
import { formatDateTime, toWatInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireAdmin();
  const [config, admins] = await Promise.all([
    getVotingConfig(),
    prisma.admin.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, lastLoginAt: true } }),
  ]);
  const status = computeVotingStatus(config);

  return (
    <>
      <PageHeader title="Settings" description="Voting window, email delivery and admin accounts." />
      <div className="grid gap-6 xl:grid-cols-2">
        <VotingWindowCard
          opensAt={toWatInputValue(config.opensAt)}
          closesAt={toWatInputValue(config.closesAt)}
          isPaused={config.isPaused}
          state={status.state}
          message={status.message}
        />
        <EmailCard
          fromAddress={env.mailFromAddress}
          fromName={env.mailFromName}
          configured={!!env.zeptoToken}
          dryRun={env.mailDryRun}
          appUrl={env.appUrl}
          defaultTo={me.email}
        />
        <AdminsCard
          meId={me.id}
          admins={admins.map((a) => ({
            id: a.id,
            name: a.name,
            email: a.email,
            lastLogin: a.lastLoginAt ? formatDateTime(a.lastLoginAt) : null,
          }))}
        />
        <PasswordCard />
      </div>
    </>
  );
}
