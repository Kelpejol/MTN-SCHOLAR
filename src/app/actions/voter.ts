"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { prisma, isUniqueViolation } from "@/lib/db";
import { env } from "@/lib/env";
import { LIMITS, OTP } from "@/lib/constants";
import { cleanText, maskEmail, normalizeMatric } from "@/lib/utils";
import { generateOtp, hashOtp, otpMatches } from "@/lib/otp";
import { getRequestMeta } from "@/lib/http";
import { getVotingStatus } from "@/lib/voting";
import { sendMail } from "@/lib/mail/zeptomail";
import { otpEmail, voteReceiptEmail } from "@/lib/mail/templates";
import { formatDateTime } from "@/lib/time";
import {
  clearPendingSession,
  clearVoterSession,
  readPendingSession,
  readVoterSession,
  setPendingSession,
  setVoterSession,
} from "@/lib/session";

export type OtpRequestResult =
  | { ok: true; maskedEmail: string; resendIn: number; devCode?: string }
  | { ok: false; error: string; retryAfter?: number };

export type VerifyResult = { ok: true } | { ok: false; error: string; expired?: boolean };

export type VoteResult = { ok: false; error: string; alreadyVoted?: boolean } | undefined;

const GENERIC_SEND_ERROR =
  "We couldn't send your code just now. Please wait a moment and try again.";

async function issueOtp(scholar: { id: string; fullName: string; email: string }): Promise<OtpRequestResult> {
  const { ip } = await getRequestMeta();
  const now = Date.now();

  const latest = await prisma.otpCode.findFirst({
    where: { scholarId: scholar.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest) {
    const elapsed = Math.floor((now - latest.createdAt.getTime()) / 1000);
    if (elapsed < OTP.resendCooldownSeconds) {
      const retryAfter = OTP.resendCooldownSeconds - elapsed;
      return {
        ok: false,
        error: `A code was just sent. You can request another in ${retryAfter}s.`,
        retryAfter,
      };
    }
  }

  const lastHour = await prisma.otpCode.count({
    where: { scholarId: scholar.id, createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
  });
  if (lastHour >= OTP.maxPerHourPerScholar) {
    return {
      ok: false,
      error: "Too many codes have been requested for this matric number. Please try again in an hour.",
    };
  }

  if (ip) {
    const fromIp = await prisma.otpCode.count({
      where: { ipAddress: ip, createdAt: { gte: new Date(now - 15 * 60 * 1000) } },
    });
    if (fromIp >= OTP.maxPer15MinPerIp) {
      return { ok: false, error: "Too many requests from your network. Please try again in a few minutes." };
    }
  }

  const code = generateOtp();
  const created = await prisma.$transaction(async (tx) => {
    // Only the newest code is ever valid.
    await tx.otpCode.updateMany({
      where: { scholarId: scholar.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return tx.otpCode.create({
      data: {
        scholarId: scholar.id,
        codeHash: hashOtp(scholar.id, code),
        expiresAt: new Date(now + OTP.ttlMinutes * 60 * 1000),
        ipAddress: ip,
      },
      select: { id: true },
    });
  });

  const mail = otpEmail({ fullName: scholar.fullName, code });
  const sent = await sendMail({ to: { email: scholar.email, name: scholar.fullName }, ...mail });
  if (!sent.ok) {
    // Don't leave an undeliverable code counting against the scholar's limits.
    await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => {});
    return { ok: false, error: GENERIC_SEND_ERROR };
  }

  await setPendingSession(scholar.id);
  return {
    ok: true,
    maskedEmail: maskEmail(scholar.email),
    resendIn: OTP.resendCooldownSeconds,
    // Local development without ZeptoMail only — never returned in production.
    devCode: env.mailDryRun ? code : undefined,
  };
}

export async function requestOtp(rawMatric: string): Promise<OtpRequestResult> {
  const matric = normalizeMatric(rawMatric);
  if (!matric) return { ok: false, error: "Please enter your matric number." };
  if (matric.length > LIMITS.matricMax) return { ok: false, error: "That matric number looks too long." };

  const status = await getVotingStatus();
  if (status.state !== "open") return { ok: false, error: status.message };

  const scholar = await prisma.scholar.findUnique({
    where: { matricNumber: matric },
    select: { id: true, fullName: true, email: true },
  });
  if (!scholar) {
    return {
      ok: false,
      error: `We couldn't find that matric number. Please check it and try again, or contact ${env.supportEmail} for help.`,
    };
  }
  return issueOtp(scholar);
}

export async function resendOtp(): Promise<OtpRequestResult> {
  const pending = await readPendingSession();
  if (!pending) return { ok: false, error: "Your session expired. Please enter your matric number again." };

  const status = await getVotingStatus();
  if (status.state !== "open") return { ok: false, error: status.message };

  const scholar = await prisma.scholar.findUnique({
    where: { id: pending.sid },
    select: { id: true, fullName: true, email: true },
  });
  if (!scholar) return { ok: false, error: "Your session expired. Please enter your matric number again." };
  return issueOtp(scholar);
}

export async function verifyOtp(rawCode: string): Promise<VerifyResult> {
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== OTP.length) return { ok: false, error: `Enter the ${OTP.length}-digit code from your email.` };

  const pending = await readPendingSession();
  if (!pending) {
    return { ok: false, expired: true, error: "Your session expired. Please enter your matric number again." };
  }

  const status = await getVotingStatus();
  if (status.state !== "open") return { ok: false, error: status.message };

  const otp = await prisma.otpCode.findFirst({
    where: { scholarId: pending.sid, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This code has expired. Tap “Resend code” to get a new one." };
  }
  if (otp.attempts >= OTP.maxAttempts) {
    return { ok: false, error: "Too many incorrect attempts. Tap “Resend code” to get a new one." };
  }

  if (!otpMatches(pending.sid, code, otp.codeHash)) {
    // Conditional update so concurrent guesses can't exceed the attempt limit.
    const bumped = await prisma.otpCode.updateMany({
      where: { id: otp.id, attempts: { lt: OTP.maxAttempts }, consumedAt: null },
      data: { attempts: { increment: 1 } },
    });
    const left = OTP.maxAttempts - otp.attempts - 1;
    if (!bumped.count || left <= 0) {
      return { ok: false, error: "Too many incorrect attempts. Tap “Resend code” to get a new one." };
    }
    return { ok: false, error: `That code isn't right. ${left} ${left === 1 ? "attempt" : "attempts"} left.` };
  }

  const consumed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (!consumed.count) return { ok: false, error: "This code has already been used. Please request a new one." };

  await setVoterSession(pending.sid);
  await clearPendingSession();
  return { ok: true };
}

export async function submitVote(input: { institutionId: string; vcName: string }): Promise<VoteResult> {
  const session = await readVoterSession();
  if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };

  const status = await getVotingStatus();
  if (status.state !== "open") return { ok: false, error: status.message };

  const vcName = cleanText(input.vcName);
  if (vcName.length < LIMITS.vcNameMin) {
    return { ok: false, error: "Please enter the Vice-Chancellor's name." };
  }
  if (vcName.length > LIMITS.vcNameMax) {
    return { ok: false, error: `The name must be ${LIMITS.vcNameMax} characters or fewer.` };
  }

  const institution = await prisma.institution.findFirst({
    where: { id: String(input.institutionId ?? ""), isActive: true },
    select: { id: true, name: true },
  });
  if (!institution) return { ok: false, error: "Please choose an institution from the list." };

  const scholar = await prisma.scholar.findUnique({
    where: { id: session.sid },
    select: { id: true, fullName: true, email: true, matricDisplay: true, vote: { select: { id: true } } },
  });
  if (!scholar) return { ok: false, error: "Your session has expired. Please sign in again." };
  if (scholar.vote) return { ok: false, alreadyVoted: true, error: "You have already voted." };

  const { ip, userAgent } = await getRequestMeta();
  let vote: { createdAt: Date };
  try {
    vote = await prisma.vote.create({
      data: { scholarId: scholar.id, institutionId: institution.id, vcName, ipAddress: ip, userAgent },
      select: { createdAt: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, alreadyVoted: true, error: "You have already voted." };
    console.error("[vote] failed to record vote", error);
    return { ok: false, error: "We couldn't record your vote. Please try again." };
  }

  // Receipt email is best-effort and must not delay or affect the vote.
  after(async () => {
    const mail = voteReceiptEmail({
      fullName: scholar.fullName,
      matric: scholar.matricDisplay,
      institution: institution.name,
      vcName,
      votedAtLabel: formatDateTime(vote.createdAt, true),
    });
    await sendMail({ to: { email: scholar.email, name: scholar.fullName }, ...mail });
  });

  redirect("/vote/done");
}

export async function cancelPending() {
  await clearPendingSession();
}

export async function signOutVoter() {
  await clearVoterSession();
  redirect("/");
}
