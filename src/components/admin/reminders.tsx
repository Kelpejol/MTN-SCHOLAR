"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatNumber, pluralize } from "@/lib/utils";

const BATCH_SIZE = 25;

type Failure = { id: string; name: string; email: string; error: string };
type Phase =
  | { kind: "setup"; error?: string }
  | { kind: "sending"; total: number; processed: number; sent: number; skipped: number; failures: Failure[] }
  | { kind: "done"; total: number; sent: number; skipped: number; failures: Failure[] };

async function api<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/admin/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
  if (!res.ok || !data.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

type ReminderDialogProps = {
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
  pendingTotal: number;
  selectedIds: string[];
  defaultScope?: "all" | "selected";
};

/** Mounted only while open, so each run starts from a clean slate. */
export function ReminderDialog(props: ReminderDialogProps) {
  return props.open ? <ReminderDialogBody {...props} /> : null;
}

function ReminderDialogBody({
  open,
  onClose,
  onSent,
  pendingTotal,
  selectedIds,
  defaultScope = "all",
}: ReminderDialogProps) {
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "selected">(selectedIds.length ? defaultScope : "all");
  const [skipRecent, setSkipRecent] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!showPreview || preview) return;
    fetch("/api/admin/reminders/preview")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { html: string }) => setPreview(data.html))
      .catch(() => toast.error("Couldn't load the preview."));
  }, [showPreview, preview]);

  const sending = phase.kind === "sending";

  async function run(ids?: string[]) {
    try {
      const targetIds =
        ids ??
        (
          await api<{ ids: string[] }>({
            action: "targets",
            scope,
            ids: scope === "selected" ? selectedIds : undefined,
            skipRecentHours: skipRecent ? 24 : 0,
          })
        ).ids;
      if (targetIds.length === 0) {
        setPhase({ kind: "setup", error: "There's no one to remind — everyone selected has voted or was reminded recently." });
        return;
      }
      const batches: string[][] = [];
      for (let i = 0; i < targetIds.length; i += BATCH_SIZE) batches.push(targetIds.slice(i, i + BATCH_SIZE));

      let processed = 0;
      let sent = 0;
      let skipped = 0;
      const failures: Failure[] = [];
      setPhase({ kind: "sending", total: targetIds.length, processed, sent, skipped, failures });

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        try {
          const res = await api<{ sent: number; skipped: number; failures: Failure[] }>({
            action: "send",
            ids: batch,
            batchNumber: b + 1,
            totalBatches: batches.length,
            runTotal: targetIds.length,
          });
          sent += res.sent;
          skipped += res.skipped;
          failures.push(...res.failures);
        } catch (e) {
          // A whole batch failed (network / session) — record and keep going.
          const message = e instanceof Error ? e.message : "Request failed";
          failures.push(...batch.map((id) => ({ id, name: "", email: "", error: message })));
        }
        processed += batch.length;
        setPhase({ kind: "sending", total: targetIds.length, processed, sent, skipped, failures: [...failures] });
      }
      setPhase({ kind: "done", total: targetIds.length, sent, skipped, failures });
      if (sent > 0) toast.success(`${pluralize(sent, "reminder")} sent`);
      onSent?.();
      router.refresh();
    } catch (e) {
      setPhase({ kind: "setup", error: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={sending}
      size="lg"
      title="Send reminder emails"
      description="Remind scholars who haven't voted yet. Scholars who have voted are always skipped."
      footer={
        phase.kind === "setup" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => run()} disabled={scope === "all" ? pendingTotal === 0 : selectedIds.length === 0}>
              <Send className="size-4" /> Send reminders
            </Button>
          </>
        ) : phase.kind === "done" ? (
          <>
            {phase.failures.length > 0 && (
              <Button variant="secondary" onClick={() => run(phase.failures.map((f) => f.id))}>
                Retry {phase.failures.length} failed
              </Button>
            )}
            <Button variant="dark" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <Button disabled loading>
            Sending…
          </Button>
        )
      }
    >
      {phase.kind === "setup" && (
        <div className="space-y-5">
          {phase.error && <Alert tone="warning">{phase.error}</Alert>}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Who should receive it?</legend>
            {[
              { value: "all" as const, label: "Everyone who hasn't voted", count: pendingTotal, disabled: pendingTotal === 0 },
              {
                value: "selected" as const,
                label: "Only the scholars I selected",
                count: selectedIds.length,
                disabled: selectedIds.length === 0,
              },
            ].map((o) => (
              <label
                key={o.value}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors",
                  scope === o.value ? "border-ink bg-zinc-50" : "border-zinc-200 hover:border-zinc-300",
                  o.disabled && "pointer-events-none opacity-50",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="scope"
                    value={o.value}
                    checked={scope === o.value}
                    onChange={() => setScope(o.value)}
                    disabled={o.disabled}
                    className="size-4 accent-brand-600"
                  />
                  <span className="text-sm font-medium">{o.label}</span>
                </span>
                <span className="text-sm text-zinc-500 tabular-nums">{formatNumber(o.count)}</span>
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={skipRecent}
              onChange={(e) => setSkipRecent(e.target.checked)}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span>
              <span className="font-medium">Skip scholars reminded in the last 24 hours</span>
              <span className="block text-zinc-500">Avoids emailing the same person twice in one day.</span>
            </span>
          </label>
          <div>
            <button
              type="button"
              onClick={() => setShowPreview((s) => !s)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {showPreview ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {showPreview ? "Hide email preview" : "Preview the email"}
            </button>
            <Link href="/admin/reminders" className="ml-4 text-sm font-medium text-zinc-600 underline-offset-4 hover:text-ink hover:underline">
              Edit the message
            </Link>
            {showPreview && (
              <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
                {preview ? (
                  <iframe title="Reminder email preview" srcDoc={preview} sandbox="" className="h-[460px] w-full bg-white" />
                ) : (
                  <div className="grid h-40 place-items-center">
                    <Spinner className="size-5 text-zinc-400" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {(phase.kind === "sending" || phase.kind === "done") && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-sm">
              <p className="flex items-center gap-2 font-medium">
                {phase.kind === "sending" ? (
                  <Spinner className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                )}
                {phase.kind === "sending" ? "Sending reminders… keep this window open." : "Finished"}
              </p>
              <p className="text-zinc-500 tabular-nums">
                {formatNumber(phase.kind === "sending" ? phase.processed : phase.total)} / {formatNumber(phase.total)}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{
                  width: `${((phase.kind === "sending" ? phase.processed : phase.total) / Math.max(1, phase.total)) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sent", value: phase.sent, tone: "text-emerald-700" },
              { label: "Skipped", value: phase.skipped, tone: "text-zinc-500" },
              { label: "Failed", value: phase.failures.length, tone: phase.failures.length ? "text-brand-700" : "text-zinc-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", s.tone)}>{formatNumber(s.value)}</p>
              </div>
            ))}
          </div>
          {phase.failures.length > 0 && (
            <Alert tone="error" title="Some emails could not be sent">
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                {phase.failures.slice(0, 100).map((f, i) => (
                  <li key={`${f.id}-${i}`}>
                    {f.name ? (
                      <>
                        <span className="font-semibold">{f.name}</span> ({f.email}):{" "}
                      </>
                    ) : null}
                    {f.error}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}
