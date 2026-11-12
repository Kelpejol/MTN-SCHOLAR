"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Mail, Monitor, PencilLine, RotateCcw, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldHint, Input, Label, inputClasses } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import { ReminderDialog } from "./reminders";
import { resetReminderTemplate, saveReminderTemplate, sendReminderTest } from "@/app/actions/admin";
import {
  DEFAULT_REMINDER_TEMPLATE,
  PLACEHOLDERS,
  findUnknownPlaceholders,
  type ReminderTemplateInput,
} from "@/lib/mail/placeholders";
import { cn, formatNumber } from "@/lib/utils";

type FieldName = "subject" | "heading" | "body" | "buttonLabel";
type Preview = { html: string; subject: string; unknownPlaceholders: string[]; from: string; to: string };

const LIMITS: Record<FieldName, number> = { subject: 150, heading: 120, body: 3000, buttonLabel: 40 };

export function ReminderEditor({
  saved,
  isCustom,
  updatedAt,
  pendingTotal,
  sentTotal,
  lastSent,
  from,
  adminEmail,
}: {
  saved: ReminderTemplateInput;
  isCustom: boolean;
  updatedAt: string | null;
  pendingTotal: number;
  sentTotal: number;
  lastSent: string | null;
  from: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReminderTemplateInput>(saved);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [testTo, setTestTo] = useState(adminEmail);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [resetting, startReset] = useTransition();
  const [iframeHeight, setIframeHeight] = useState(760);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Size the preview frame to its content. Uses the body (not the document) so it can shrink as
  // well as grow, and re-measures whenever the width changes (device toggle, tab switch, resize).
  const measure = useCallback(() => {
    const body = iframeRef.current?.contentDocument?.body;
    if (body) setIframeHeight(Math.max(420, Math.ceil(body.getBoundingClientRect().height)));
  }, []);
  useEffect(() => {
    const t = setTimeout(measure, 150);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [device, tab, preview, measure]);

  const subjectRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLInputElement>(null);
  const lastField = useRef<FieldName>("body");

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const unknown = useMemo(
    () => findUnknownPlaceholders(draft.subject, draft.heading, draft.body, draft.buttonLabel),
    [draft],
  );

  // Live preview, debounced; stale responses are discarded.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/admin/reminders/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("preview failed");
        setPreview((await res.json()) as Preview);
        setPreviewError(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setPreviewError(true);
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft]);

  function setField<K extends keyof ReminderTemplateInput>(key: K, value: ReminderTemplateInput[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function insertPlaceholder(key: string) {
    const field = lastField.current;
    const el = { subject: subjectRef, heading: headingRef, body: bodyRef, buttonLabel: buttonRef }[field].current;
    const token = `{{${key}}}`;
    const current = draft[field];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = (current.slice(0, start) + token + current.slice(end)).slice(0, LIMITS[field]);
    setField(field, next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = Math.min(start + token.length, next.length);
      el?.setSelectionRange(pos, pos);
    });
  }

  function save() {
    startSave(async () => {
      const res = await saveReminderTemplate(draft);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Reminder message saved");
        router.refresh();
      }
    });
  }

  const editor = (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <PencilLine className="size-4 text-brand-600" /> Write your message
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {isCustom && updatedAt ? `Last saved ${updatedAt}.` : "Using the default message. Edit it however you like."}
            </p>
          </div>
          {dirty ? <Badge tone="warning">Unsaved changes</Badge> : <Badge tone="success">Saved</Badge>}
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="r-subject">Subject line</Label>
            <Input
              id="r-subject"
              ref={subjectRef}
              value={draft.subject}
              maxLength={LIMITS.subject}
              onFocus={() => (lastField.current = "subject")}
              onChange={(e) => setField("subject", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="r-heading">Heading inside the email</Label>
            <Input
              id="r-heading"
              ref={headingRef}
              value={draft.heading}
              maxLength={LIMITS.heading}
              onFocus={() => (lastField.current = "heading")}
              onChange={(e) => setField("heading", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="r-body">Message</Label>
            <textarea
              id="r-body"
              ref={bodyRef}
              rows={11}
              value={draft.body}
              maxLength={LIMITS.body}
              onFocus={() => (lastField.current = "body")}
              onChange={(e) => setField("body", e.target.value)}
              className={cn(inputClasses(false), "h-auto min-h-48 resize-y py-3 leading-relaxed")}
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                Leave a blank line for a new paragraph. Wrap words in <code className="rounded bg-zinc-100 px-1">**double stars**</code> to make
                them bold.
              </span>
              <span className="tabular-nums">
                {formatNumber(draft.body.length)} / {formatNumber(LIMITS.body)}
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="r-button">Button text</Label>
              <Input
                id="r-button"
                ref={buttonRef}
                value={draft.buttonLabel}
                maxLength={LIMITS.buttonLabel}
                onFocus={() => (lastField.current = "buttonLabel")}
                onChange={(e) => setField("buttonLabel", e.target.value)}
              />
              <FieldHint>The button always opens the voting page.</FieldHint>
            </div>
            <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm font-medium sm:mb-[22px]">
              <input
                type="checkbox"
                checked={draft.showSteps}
                onChange={(e) => setField("showSteps", e.target.checked)}
                className="size-4 accent-brand-600"
              />
              Show the 3 “how to vote” steps
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">Personalise with placeholders</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Click to insert at your cursor, or type them yourself. Each scholar gets their own details filled in.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => insertPlaceholder(p.key)}
              title={p.hint}
              className="group inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50/50"
            >
              <span className="font-medium">{p.label}</span>
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 group-hover:bg-white">{`{{${p.key}}}`}</code>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Also understood: <code>{"{{full name}}"}</code>, <code>{"{{name}}"}</code>, <code>{"{{matric}}"}</code>, <code>{"{{link}}"}</code>,{" "}
          <code>{"{{deadline}}"}</code>.
        </p>
        {unknown.length > 0 && (
          <Alert tone="warning" className="mt-4" title="Unrecognised placeholder">
            {unknown.join(", ")} will be sent exactly as typed. Check the spelling, or use one from the list above.
          </Alert>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="dark" onClick={save} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
          <Button variant="secondary" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
            Discard edits
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirmReset(true)}
            disabled={JSON.stringify(draft) === JSON.stringify(DEFAULT_REMINDER_TEMPLATE) && !isCustom}
          >
            <RotateCcw className="size-4" /> Reset to default
          </Button>
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4 text-zinc-500" /> Send yourself a test
          </h3>
          <p className="mt-0.5 text-sm text-zinc-500">Sends the version above (even if unsaved) filled with sample details.</p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              startTest(async () => {
                const res = await sendReminderTest(draft, testTo);
                if (!res.ok) toast.error(res.error, { duration: 10000 });
                else toast.success(`Test sent to ${testTo}`);
              });
            }}
          >
            <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Send test to" required />
            <Button type="submit" variant="secondary" loading={testing} className="shrink-0">
              Send test
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );

  const previewPanel = (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Eye className="size-4 text-brand-600" /> Live preview
            {previewLoading && <Spinner className="size-3.5 text-zinc-400" />}
          </h2>
          <div className="inline-flex rounded-lg border border-zinc-200 p-0.5" role="tablist" aria-label="Preview size">
            {(
              [
                ["desktop", Monitor, "Desktop"],
                ["phone", Smartphone, "Phone"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={device === value}
                onClick={() => setDevice(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                  device === value ? "bg-ink text-white" : "text-zinc-600 hover:text-ink",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Inbox header */}
        <dl className="space-y-1 border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 text-sm sm:px-5">
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-zinc-500">From</dt>
            <dd className="min-w-0 truncate">{preview?.from ?? from}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-zinc-500">To</dt>
            <dd className="min-w-0 truncate">{preview?.to ?? "…"}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-zinc-500">Subject</dt>
            <dd className="min-w-0 font-semibold break-words">{preview?.subject ?? "…"}</dd>
          </div>
        </dl>

        <div className="bg-zinc-100 p-3 sm:p-5">
          {previewError && !preview ? (
            <Alert tone="error">Couldn&apos;t load the preview. Check your connection and try again.</Alert>
          ) : (
            <div
              className={cn(
                "mx-auto overflow-hidden bg-white transition-all",
                device === "phone" ? "max-w-[390px] rounded-[28px] border-[6px] border-ink shadow-xl" : "max-w-full rounded-xl",
              )}
            >
              <iframe
                ref={iframeRef}
                title="Reminder email preview"
                srcDoc={preview?.html ?? ""}
                // allow-same-origin only so we can measure the height; no scripts are allowed.
                sandbox="allow-same-origin"
                style={{ height: iframeHeight }}
                className="block w-full border-0 bg-white"
                onLoad={measure}
              />
            </div>
          )}
          <p className="mt-3 text-center text-xs text-zinc-500">
            Shown with sample scholar details ({PLACEHOLDERS[0].sample}). Real emails use each scholar&apos;s own.
          </p>
        </div>
      </Card>
    </div>
  );

  return (
    <>
      {/* Stats + send */}
      <Card className="mb-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <dl className="grid grid-cols-3 gap-4 sm:flex sm:gap-10">
          <div>
            <dt className="text-xs text-zinc-500">Yet to vote</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums">{formatNumber(pendingTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Reminders sent</dt>
            <dd className="mt-0.5 text-xl font-bold tabular-nums">{formatNumber(sentTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Last sent</dt>
            <dd className="mt-1 text-sm font-semibold">{lastSent ?? "Never"}</dd>
          </div>
        </dl>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <Button onClick={() => setSendOpen(true)} disabled={dirty || pendingTotal === 0}>
            <Send className="size-4" /> Send reminders…
          </Button>
          {dirty && <p className="text-xs text-amber-700">Save your changes first — sending uses the saved message.</p>}
        </div>
      </Card>

      {/* Mobile / tablet: switch between the editor and the preview */}
      <div className="mb-4 inline-flex rounded-xl border border-zinc-200 bg-white p-1 xl:hidden" role="tablist">
        {(
          [
            ["edit", PencilLine, "Edit"],
            ["preview", Eye, "Preview"],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium",
              tab === value ? "bg-ink text-white" : "text-zinc-600",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:items-start">
        <div className={cn("min-w-0", tab === "preview" && "max-xl:hidden")}>{editor}</div>
        <div className={cn("min-w-0 xl:sticky xl:top-6", tab === "edit" && "max-xl:hidden")}>{previewPanel}</div>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        locked={resetting}
        size="sm"
        title="Reset to the default message?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button
              loading={resetting}
              onClick={() =>
                startReset(async () => {
                  const res = await resetReminderTemplate();
                  if (!res.ok) toast.error(res.error);
                  else {
                    setDraft(DEFAULT_REMINDER_TEMPLATE);
                    setConfirmReset(false);
                    toast.success("Reset to the default message");
                    router.refresh();
                  }
                })
              }
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">Your current wording will be replaced by the built-in message.</p>
      </Dialog>

      <ReminderDialog open={sendOpen} onClose={() => setSendOpen(false)} pendingTotal={pendingTotal} selectedIds={[]} />
    </>
  );
}

