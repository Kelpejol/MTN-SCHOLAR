import "server-only";
import { prisma } from "./db";
import { DEFAULT_CLOSES_AT, DEFAULT_OPENS_AT } from "./constants";
import { formatFullMoment } from "./time";

export type VotingState = "scheduled" | "open" | "closed" | "paused";

export type VotingStatus = {
  state: VotingState;
  opensAt: Date;
  closesAt: Date;
  isPaused: boolean;
  /** Short human message suitable for the voter-facing UI. */
  message: string;
};

export async function getVotingConfig() {
  const existing = await prisma.votingConfig.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.votingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, opensAt: new Date(DEFAULT_OPENS_AT), closesAt: new Date(DEFAULT_CLOSES_AT) },
  });
}

export function computeVotingStatus(
  config: { opensAt: Date; closesAt: Date; isPaused: boolean },
  now = new Date(),
): VotingStatus {
  const base = { opensAt: config.opensAt, closesAt: config.closesAt, isPaused: config.isPaused };
  if (config.isPaused) {
    return {
      ...base,
      state: "paused",
      message: "Voting is temporarily paused. Please check back shortly.",
    };
  }
  if (now < config.opensAt) {
    return {
      ...base,
      state: "scheduled",
      message: `Voting opens on ${formatFullMoment(config.opensAt)}.`,
    };
  }
  if (now >= config.closesAt) {
    return {
      ...base,
      state: "closed",
      message: `Voting closed on ${formatFullMoment(config.closesAt)}. Thank you for your interest.`,
    };
  }
  return { ...base, state: "open", message: `Voting closes on ${formatFullMoment(config.closesAt)}.` };
}

export async function getVotingStatus(): Promise<VotingStatus> {
  return computeVotingStatus(await getVotingConfig());
}
