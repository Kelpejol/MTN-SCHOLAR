import "server-only";
import { cookies } from "next/headers";
import {
  COOKIES,
  TTL,
  signToken,
  verifyToken,
  type AdminToken,
  type PendingToken,
  type VoterToken,
} from "./tokens";

const secure = process.env.NODE_ENV === "production";

async function setCookie(name: string, value: string, maxAge: number) {
  const store = await cookies();
  store.set(name, value, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge });
}

async function clearCookie(name: string) {
  const store = await cookies();
  store.set(name, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
}

async function readCookie(name: string) {
  return (await cookies()).get(name)?.value;
}

// ---- Voter: pending (between matric entry and OTP verification) ----
export async function setPendingSession(scholarId: string) {
  await setCookie(
    COOKIES.pending,
    await signToken({ typ: "pending", sid: scholarId }, TTL.pendingSeconds),
    TTL.pendingSeconds,
  );
}
export async function readPendingSession() {
  return verifyToken<PendingToken>(await readCookie(COOKIES.pending), "pending");
}
export async function clearPendingSession() {
  await clearCookie(COOKIES.pending);
}

// ---- Voter: authenticated ----
export async function setVoterSession(scholarId: string) {
  await setCookie(
    COOKIES.voter,
    await signToken({ typ: "voter", sid: scholarId }, TTL.voterSeconds),
    TTL.voterSeconds,
  );
}
export async function readVoterSession() {
  return verifyToken<VoterToken>(await readCookie(COOKIES.voter), "voter");
}
export async function clearVoterSession() {
  await clearCookie(COOKIES.voter);
  await clearCookie(COOKIES.pending);
}

// ---- Admin ----
export async function setAdminSession(adminId: string) {
  await setCookie(
    COOKIES.admin,
    await signToken({ typ: "admin", aid: adminId }, TTL.adminSeconds),
    TTL.adminSeconds,
  );
}
export async function readAdminSession() {
  return verifyToken<AdminToken>(await readCookie(COOKIES.admin), "admin");
}
export async function clearAdminSession() {
  await clearCookie(COOKIES.admin);
}
