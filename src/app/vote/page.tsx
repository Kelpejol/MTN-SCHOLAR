import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { SiteFooter } from "@/components/brand";
import { VoterHeader } from "@/components/voter/voter-header";
import { BallotForm } from "@/components/voter/ballot-form";
import { Alert } from "@/components/ui/misc";
import { requireVoter } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVotingStatus } from "@/lib/voting";
import { formatFullMoment } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cast your vote" };

export default async function VotePage() {
  const voter = await requireVoter();
  if (voter.vote) redirect("/vote/done");

  const status = await getVotingStatus();
  const firstName = voter.fullName.split(" ")[0] || "Scholar";

  const institutions =
    status.state === "open"
      ? await prisma.institution.findMany({
          where: { isActive: true },
          select: { id: true, name: true, location: true },
        })
      : [];
  institutions.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

  return (
    <>
      <VoterHeader name={voter.fullName} matric={voter.matricDisplay} />
      <main className="flex-1 bg-zinc-50/60">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
          {status.state === "open" ? (
            <>
              <BallotForm institutions={institutions} firstName={firstName} />
              <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
                <Clock className="size-3.5" /> Voting closes {formatFullMoment(status.closesAt)}
              </p>
            </>
          ) : (
            <Alert tone="info" title="Voting is not open">
              {status.message}
            </Alert>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
