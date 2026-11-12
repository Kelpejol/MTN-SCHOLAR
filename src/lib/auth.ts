import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { readAdminSession, readVoterSession } from "./session";

/** The signed-in scholar (with their vote, if any), or null. */
export const getVoter = cache(async () => {
  const session = await readVoterSession();
  if (!session) return null;
  return prisma.scholar.findUnique({
    where: { id: session.sid },
    select: {
      id: true,
      fullName: true,
      matricDisplay: true,
      email: true,
      vote: {
        select: {
          id: true,
          vcName: true,
          createdAt: true,
          institution: { select: { name: true, ceremonyRegion: true } },
        },
      },
    },
  });
});

export async function requireVoter() {
  const voter = await getVoter();
  if (!voter) redirect("/");
  return voter;
}

export type CurrentAdmin = { id: string; name: string; email: string };

export const getAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await readAdminSession();
  if (!session) return null;
  return prisma.admin.findUnique({
    where: { id: session.aid },
    select: { id: true, name: true, email: true },
  });
});

/** For admin pages and server actions. Redirects to the login page when not signed in. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
