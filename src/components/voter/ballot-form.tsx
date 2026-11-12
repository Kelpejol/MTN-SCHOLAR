"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { submitVote } from "@/app/actions/voter";
import { BRAND, LIMITS } from "@/lib/constants";

type InstitutionOption = { id: string; name: string; location: string | null };

export function BallotForm({ institutions, firstName }: { institutions: InstitutionOption[]; firstName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [vcName, setVcName] = useState("");
  const [errors, setErrors] = useState<{ institution?: string; vcName?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  const institution = institutions.find((i) => i.id === institutionId) ?? null;
  const options = institutions.map((i) => ({ value: i.id, label: i.name, hint: i.location }));

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function review(e: React.FormEvent) {
    e.preventDefault();
    const name = vcName.replace(/\s+/g, " ").trim();
    const next: typeof errors = {};
    if (!institution) next.institution = "Please choose an institution.";
    if (name.length < LIMITS.vcNameMin) next.vcName = "Please enter the Vice-Chancellor's name.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(next.institution ? "institution" : "vcName")?.focus();
      return;
    }
    setVcName(name);
    setSubmitError(null);
    setStep("review");
    scrollTop();
  }

  function confirm() {
    if (!institution) return;
    setSubmitError(null);
    startTransition(async () => {
      const res = await submitVote({ institutionId: institution.id, vcName });
      // On success the action redirects to /vote/done.
      if (res && !res.ok) {
        if (res.alreadyVoted) {
          router.replace("/vote/done");
          router.refresh();
          return;
        }
        setSubmitError(res.error);
      }
    });
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Progress */}
      <ol className="mb-6 flex items-center gap-3 text-xs font-medium" aria-label="Progress">
        <li className="flex items-center gap-2 text-ink">
          <span className="grid size-6 place-items-center rounded-full bg-ink text-white">
            {step === "review" ? <CheckCircle2 className="size-3.5" /> : 1}
          </span>
          Your choice
        </li>
        <li aria-hidden className="h-px flex-1 bg-zinc-200" />
        <li className={step === "review" ? "flex items-center gap-2 text-ink" : "flex items-center gap-2 text-zinc-400"}>
          <span
            className={
              step === "review"
                ? "grid size-6 place-items-center rounded-full bg-brand-600 text-white"
                : "grid size-6 place-items-center rounded-full border border-zinc-300"
            }
          >
            2
          </span>
          Confirm
        </li>
      </ol>

      {step === "edit" ? (
        <form onSubmit={review} noValidate className="animate-fade-in">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.16)] sm:p-8">
            <p className="text-sm text-zinc-500">Hello {firstName},</p>
            <h1 className="mt-1 text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
              {BRAND.question}
            </h1>

            <div className="mt-7 space-y-6">
              <div>
                <Label htmlFor="institution">Institution</Label>
                <Combobox
                  id="institution"
                  options={options}
                  value={institutionId}
                  onChange={(v) => {
                    setInstitutionId(v);
                    setErrors((e) => ({ ...e, institution: undefined }));
                  }}
                  placeholder="Select an institution"
                  searchPlaceholder="Search institutions…"
                  sheetTitle="Select an institution"
                  invalid={!!errors.institution}
                  describedBy={errors.institution ? "institution-error" : "institution-hint"}
                />
                {errors.institution ? (
                  <FieldError id="institution-error">{errors.institution}</FieldError>
                ) : (
                  <FieldHint id="institution-hint">Your vote is counted for the institution you choose.</FieldHint>
                )}
              </div>

              <div>
                <Label htmlFor="vcName">Vice-Chancellor&apos;s name</Label>
                <Input
                  id="vcName"
                  value={vcName}
                  onChange={(e) => {
                    setVcName(e.target.value);
                    setErrors((er) => ({ ...er, vcName: undefined }));
                  }}
                  placeholder="e.g. Professor Jane Doe"
                  maxLength={LIMITS.vcNameMax}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  invalid={!!errors.vcName}
                  aria-describedby={errors.vcName ? "vc-error" : "vc-hint"}
                  className="h-12 text-base"
                />
                {errors.vcName ? (
                  <FieldError id="vc-error">{errors.vcName}</FieldError>
                ) : (
                  <FieldHint id="vc-hint">
                    For reference only — if you&apos;re unsure of the exact spelling, write it as best you can.
                  </FieldHint>
                )}
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-8 w-full sm:w-auto">
              Review my vote <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="animate-fade-in rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.16)] sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Confirm your vote</h1>
          <p className="mt-1.5 text-sm text-zinc-600">Please check your choice carefully before submitting.</p>

          <dl className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
            <div className="bg-zinc-50 px-4 py-3.5 sm:px-5">
              <dt className="text-xs font-medium text-zinc-500">Question</dt>
              <dd className="mt-0.5 text-sm leading-relaxed">{BRAND.question}</dd>
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-4 py-4 sm:px-5">
              <Building2 className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-zinc-500">Institution</dt>
                <dd className="mt-0.5 text-base font-semibold">{institution?.name}</dd>
                {institution?.location && <dd className="text-sm text-zinc-500">{institution.location}</dd>}
              </div>
            </div>
            <div className="flex gap-3 border-t border-zinc-200 px-4 py-4 sm:px-5">
              <UserRound className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-zinc-500">Vice-Chancellor</dt>
                <dd className="mt-0.5 text-base font-semibold break-words">{vcName}</dd>
              </div>
            </div>
          </dl>

          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Your vote is final.</span> Once submitted it cannot be changed or
              withdrawn.
            </p>
          </div>

          {submitError && (
            <Alert tone="error" className="mt-4">
              {submitError}
            </Alert>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="secondary"
              size="lg"
              disabled={pending}
              onClick={() => {
                setStep("edit");
                scrollTop();
              }}
            >
              <ArrowLeft className="size-4" /> Go back and edit
            </Button>
            <Button size="lg" loading={pending} onClick={confirm}>
              {pending ? "Submitting…" : "Confirm and submit vote"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
