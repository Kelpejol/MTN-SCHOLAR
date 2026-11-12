"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { OtpInput } from "./otp-input";
import { cancelPending, requestOtp, resendOtp, verifyOtp } from "@/app/actions/voter";

type Step = { kind: "matric" } | { kind: "otp"; maskedEmail: string; devCode?: string };

export function LoginCard({ votingOpen, closedMessage }: { votingOpen: boolean; closedMessage: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "matric" });
  const [matric, setMatric] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const matricRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  // Focus the field for mouse/keyboard users only — on phones it would pop the keyboard up and
  // scroll the page past the title before anyone has read it.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) matricRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step.kind === "otp") requestAnimationFrame(() => otpRef.current?.focus());
  }, [step.kind]);

  function submitMatric(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!matric.trim()) {
      setError("Please enter your matric number.");
      matricRef.current?.focus();
      return;
    }
    startTransition(async () => {
      const res = await requestOtp(matric);
      if (res.ok) {
        setCode("");
        setStep({ kind: "otp", maskedEmail: res.maskedEmail, devCode: res.devCode });
        setCooldown(res.resendIn);
      } else {
        setError(res.error);
        if (res.retryAfter) {
          // A code was already sent recently — let them enter it.
          setStep({ kind: "otp", maskedEmail: "your registered email" });
          setCooldown(res.retryAfter);
        }
      }
    });
  }

  function submitCode(value = code) {
    setError(null);
    if (value.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    startTransition(async () => {
      const res = await verifyOtp(value);
      if (res.ok) {
        setRedirecting(true);
        router.replace("/vote");
        router.refresh();
        return;
      }
      setError(res.error);
      setCode("");
      if (res.expired) setStep({ kind: "matric" });
      else requestAnimationFrame(() => otpRef.current?.focus());
    });
  }

  function resend() {
    setError(null);
    startResend(async () => {
      const res = await resendOtp();
      if (res.ok) {
        setCode("");
        setStep({ kind: "otp", maskedEmail: res.maskedEmail, devCode: res.devCode });
        setCooldown(res.resendIn);
      } else {
        setError(res.error);
        if (res.retryAfter) setCooldown(res.retryAfter);
      }
    });
  }

  function changeMatric() {
    setError(null);
    setCode("");
    setStep({ kind: "matric" });
    void cancelPending();
    requestAnimationFrame(() => matricRef.current?.focus());
  }

  if (!votingOpen) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Voting is not open</h2>
        <Alert tone="info">{closedMessage}</Alert>
      </div>
    );
  }

  if (step.kind === "matric") {
    return (
      <form onSubmit={submitMatric} noValidate className="animate-fade-in space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Sign in to vote</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Enter your matric number. We&apos;ll email a one-time code to the address registered with your
            scholarship.
          </p>
        </div>
        <div>
          <Label htmlFor="matric">Matric number</Label>
          <Input
            ref={matricRef}
            id="matric"
            name="matric"
            value={matric}
            onChange={(e) => setMatric(e.target.value)}
            placeholder="e.g. EEG/2021/004"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={60}
            invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            className="h-12 text-base"
          />
          <FieldError id="login-error">{error}</FieldError>
        </div>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? "Sending code…" : "Send my code"}
          {!pending && <ArrowRight className="size-4" />}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
          <Lock className="size-3.5" /> One vote per matric number. Votes are final.
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitCode();
      }}
      noValidate
      className="animate-fade-in space-y-5"
    >
      <div>
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <MailCheck className="size-5" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Check your email</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
          We sent a 6-digit code to <span className="font-medium text-ink">{step.maskedEmail}</span>. It expires in
          10 minutes.
        </p>
      </div>
      {step.devCode && (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <span className="font-semibold">Dev mode:</span> email isn&apos;t configured, so here&apos;s the code:{" "}
          <span className="font-mono font-semibold tracking-widest">{step.devCode}</span>
        </div>
      )}
      <div>
        <OtpInput
          ref={otpRef}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={(v) => submitCode(v)}
          invalid={!!error}
          disabled={pending || redirecting}
          describedBy={error ? "otp-error" : "otp-hint"}
        />
        {error ? (
          <FieldError id="otp-error">{error}</FieldError>
        ) : (
          <p id="otp-hint" className="mt-2 text-xs text-zinc-500">
            Can&apos;t find it? Check your spam or promotions folder.
          </p>
        )}
      </div>
      <Button type="submit" size="lg" loading={pending || redirecting} className="w-full">
        {redirecting ? "Opening ballot…" : pending ? "Verifying…" : "Verify and continue"}
      </Button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={changeMatric}
          className="inline-flex items-center gap-1.5 rounded-md font-medium text-zinc-600 hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Change matric
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="rounded-md font-medium text-brand-600 hover:text-brand-700 disabled:text-zinc-400"
        >
          {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
