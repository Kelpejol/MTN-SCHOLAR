import { prisma } from "@/lib/db";
import { guardAdminApi, jsonError } from "@/lib/http";
import { csvResponse, toCsv } from "@/lib/csv";
import { getResults } from "@/lib/results";
import { fileStamp, formatDateTime } from "@/lib/time";
import { UNASSIGNED_REGION, zoneLabel } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KINDS = ["votes", "results", "vc-names", "scholars", "institutions"] as const;
type Kind = (typeof KINDS)[number];

export async function GET(request: Request, ctx: RouteContext<"/api/admin/export/[kind]">) {
  const guard = await guardAdminApi(request);
  if (guard.response) return guard.response;
  const { kind } = await ctx.params;
  if (!KINDS.includes(kind as Kind)) return jsonError("Unknown export.", 404);

  const stamp = fileStamp();
  let response: Response;

  switch (kind as Kind) {
    case "votes": {
      const votes = await prisma.vote.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          scholar: { select: { fullName: true, matricDisplay: true, email: true } },
          institution: { select: { name: true, ceremonyRegion: true } },
        },
      });
      response = csvResponse(
        `votes-${stamp}.csv`,
        toCsv(
          ["#", "Voted At (WAT)", "Full Name", "Matric Number", "Email", "Institution", "Ceremony Region", "Vice-Chancellor Name (as entered)"],
          votes.map((v, i) => [
            i + 1,
            formatDateTime(v.createdAt),
            v.scholar.fullName,
            v.scholar.matricDisplay,
            v.scholar.email,
            v.institution.name,
            v.institution.ceremonyRegion ?? UNASSIGNED_REGION,
            v.vcName,
          ]),
        ),
      );
      break;
    }
    case "results": {
      const { regions } = await getResults();
      const rows = regions.flatMap((r) =>
        r.institutions.map((inst) => [
          r.region,
          inst.rank,
          inst.name,
          inst.votes,
          `${(inst.share * 100).toFixed(1)}%`,
          r.totalVotes,
          inst.isLeader ? (r.leaders.length > 1 ? "Tied for first" : "Winner") : "",
        ]),
      );
      response = csvResponse(
        `results-by-region-${stamp}.csv`,
        toCsv(["Ceremony Region", "Rank", "Institution", "Votes", "Share of Region", "Region Total", "Status"], rows),
      );
      break;
    }
    case "vc-names": {
      // Every free-text name grouped by institution, with how many scholars typed it
      // (case/spacing-insensitive), so the client can confirm the Vice-Chancellor's name.
      const votes = await prisma.vote.findMany({
        select: { vcName: true, institution: { select: { name: true, ceremonyRegion: true } } },
      });
      const groups = new Map<string, { region: string; institution: string; name: string; count: number }>();
      for (const v of votes) {
        const key = `${v.institution.name}::${v.vcName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
        const g = groups.get(key);
        if (g) g.count++;
        else
          groups.set(key, {
            region: v.institution.ceremonyRegion ?? UNASSIGNED_REGION,
            institution: v.institution.name,
            name: v.vcName,
            count: 1,
          });
      }
      const rows = [...groups.values()].sort(
        (a, b) => a.region.localeCompare(b.region) || a.institution.localeCompare(b.institution) || b.count - a.count,
      );
      response = csvResponse(
        `vc-names-${stamp}.csv`,
        toCsv(
          ["Ceremony Region", "Institution", "Vice-Chancellor Name (as entered)", "Times Entered"],
          rows.map((r) => [r.region, r.institution, r.name, r.count]),
        ),
      );
      break;
    }
    case "scholars": {
      const scholars = await prisma.scholar.findMany({
        orderBy: { fullName: "asc" },
        include: { vote: { include: { institution: { select: { name: true } } } } },
      });
      response = csvResponse(
        `scholars-${stamp}.csv`,
        toCsv(
          ["Full Name", "Matric Number", "Email", "Status", "Voted At (WAT)", "Institution", "Vice-Chancellor Name", "Reminders Sent", "Last Reminded (WAT)"],
          scholars.map((s) => [
            s.fullName,
            s.matricDisplay,
            s.email,
            s.vote ? "Voted" : "Not voted",
            s.vote ? formatDateTime(s.vote.createdAt) : "",
            s.vote?.institution.name ?? "",
            s.vote?.vcName ?? "",
            s.reminderCount,
            s.lastRemindedAt ? formatDateTime(s.lastRemindedAt) : "",
          ]),
        ),
      );
      break;
    }
    case "institutions": {
      const institutions = await prisma.institution.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { votes: true } } },
      });
      response = csvResponse(
        `institutions-${stamp}.csv`,
        toCsv(
          ["Institution", "Location", "Geopolitical Zone", "Ceremony Region", "On Ballot", "Votes"],
          institutions.map((i) => [
            i.name,
            i.location ?? "",
            zoneLabel(i.geopoliticalZone),
            i.ceremonyRegion ?? "",
            i.isActive ? "Yes" : "No",
            i._count.votes,
          ]),
        ),
      );
      break;
    }
  }

  await logAudit(guard.admin.id, "export", `Exported ${kind}`);
  return response;
}
