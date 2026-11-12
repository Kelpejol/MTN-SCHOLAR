import "server-only";
import { prisma } from "./db";
import { PRIMARY_REGIONS, UNASSIGNED_REGION } from "./constants";

export type ResultRow = {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
  votes: number;
  rank: number;
  share: number; // 0..1 of the region's votes
  isLeader: boolean;
};

export type RegionResult = {
  region: string;
  totalVotes: number;
  institutions: ResultRow[];
  leaders: ResultRow[]; // more than one = tie for first place
};

export function sortRegions(regions: string[]): string[] {
  const primary = PRIMARY_REGIONS as readonly string[];
  return [...regions].sort((a, b) => {
    const ia = primary.indexOf(a);
    const ib = primary.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    if (a === UNASSIGNED_REGION) return 1;
    if (b === UNASSIGNED_REGION) return -1;
    return a.localeCompare(b);
  });
}

/** Votes per institution, grouped by ceremony region, ranked with ties. */
export async function getResults(): Promise<{ regions: RegionResult[]; totalVotes: number }> {
  const institutions = await prisma.institution.findMany({
    select: {
      id: true,
      name: true,
      location: true,
      ceremonyRegion: true,
      isActive: true,
      _count: { select: { votes: true } },
    },
  });

  const byRegion = new Map<string, typeof institutions>();
  for (const inst of institutions) {
    const region = inst.ceremonyRegion || UNASSIGNED_REGION;
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push(inst);
  }

  const regions: RegionResult[] = sortRegions([...byRegion.keys()]).map((region) => {
    const list = byRegion.get(region)!;
    const totalVotes = list.reduce((sum, i) => sum + i._count.votes, 0);
    const sorted = [...list].sort(
      (a, b) => b._count.votes - a._count.votes || a.name.localeCompare(b.name),
    );
    const top = sorted[0]?._count.votes ?? 0;
    let lastVotes = -1;
    let lastRank = 0;
    const rows: ResultRow[] = sorted.map((inst, index) => {
      const votes = inst._count.votes;
      const rank = votes === lastVotes ? lastRank : index + 1; // standard competition ranking
      lastVotes = votes;
      lastRank = rank;
      return {
        id: inst.id,
        name: inst.name,
        location: inst.location,
        isActive: inst.isActive,
        votes,
        rank,
        share: totalVotes ? votes / totalVotes : 0,
        isLeader: top > 0 && votes === top,
      };
    });
    // Hide inactive institutions with no votes — they were never on the ballot.
    const visible = rows.filter((r) => r.isActive || r.votes > 0);
    return { region, totalVotes, institutions: visible, leaders: visible.filter((r) => r.isLeader) };
  });

  return {
    regions: regions.filter((r) => r.institutions.length > 0),
    totalVotes: regions.reduce((s, r) => s + r.totalVotes, 0),
  };
}
