// Signed session tokens (HS256). No `next/headers` import so this also runs inside proxy.ts.
import { SignJWT, jwtVerify } from "jose";

export const COOKIES = {
  voter: "vc_voter",
  pending: "vc_pending",
  admin: "vc_admin",
} as const;

export const TTL = {
  voterSeconds: 60 * 60, // 1 hour
  pendingSeconds: 15 * 60, // OTP entry window
  adminSeconds: 12 * 60 * 60, // 12 hours
} as const;

export type VoterToken = { typ: "voter"; sid: string };
export type PendingToken = { typ: "pending"; sid: string };
export type AdminToken = { typ: "admin"; aid: string };
type AnyToken = VoterToken | PendingToken | AdminToken;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: AnyToken, ttlSeconds: number): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secretKey());
}

export async function verifyToken<T extends AnyToken>(
  token: string | undefined,
  typ: T["typ"],
): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.typ !== typ) return null;
    return payload as unknown as T;
  } catch {
    return null;
  }
}
