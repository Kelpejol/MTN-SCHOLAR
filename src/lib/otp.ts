import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "./env";
import { OTP } from "./constants";

export function generateOtp(): string {
  return randomInt(0, 10 ** OTP.length)
    .toString()
    .padStart(OTP.length, "0");
}

export function hashOtp(scholarId: string, code: string): string {
  return createHmac("sha256", env.sessionSecret).update(`${scholarId}:${code}`).digest("hex");
}

export function otpMatches(scholarId: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(scholarId, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
