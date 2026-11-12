"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/misc";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { DownloadLink } from "@/components/ui/download-link";

type Issue = { rowNumber: number; message: string };
type Summary = {
  fileName: string;
  sheetName: string | null;
  totalRows: number;
  valid: number;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  errors: Issue[];
  errorCount: number;
  warnings: Issue[];
  warningCount: number;
  newSample: { rowNumber: number; fullName: string; matricDisplay: string; email: string }[];
  updates: { rowNumber: number; matricDisplay: string; changes: string[] }[];
};

type State =
  | { phase: "pick"; error?: string }
  | { phase: "checking"; file: File }
  | { phase: "preview"; file: File; summary: Summary }
  | { phase: "importing"; file: File; summary: Summary };

async function post(file: File, mode: "preview" | "commit") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mode", mode);
  const res = await fetch("/api/admin/scholars/import", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({ ok: false, error: "Unexpected server response." }))) as
    | { ok: true; summary: Summary }
    | { ok: false; error: string };
  if (res.status === 401) throw new Error("Your session has expired. Please sign in again.");
  return data;
}

export function UploadScholarsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "pick" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = state.phase === "checking" || state.phase === "importing";

  function reset() {
    setState({ phase: "pick" });
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function check(file: File) {
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setState({ phase: "pick", error: "Upload a .csv or .xlsx file." });
      return;
    }
    setState({ phase: "checking", file });
    try {
      const data = await post(file, "preview");
      if (!data.ok) setState({ phase: "pick", error: data.error });
      else setState({ phase: "preview", file, summary: data.summary });
    } catch (e) {
      setState({ phase: "pick", error: e instanceof Error ? e.message : "Upload failed. Please try again." });
    }
  }

  async function commit() {
    if (state.phase !== "preview") return;
    const { file, summary } = state;
    setState({ phase: "importing", file, summary });
    try {
      const data = await post(file, "commit");
      if (!data.ok) {
        toast.error(data.error);
        setState({ phase: "preview", file, summary });
        return;
      }
      toast.success(
        `Import complete: ${formatNumber(data.summary.newCount)} added, ${formatNumber(data.summary.updateCount)} updated.`,
      );
      reset();
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed. Please try again.");
      setState({ phase: "preview", file, summary });
    }
  }

  const summary = state.phase === "preview" || state.phase === "importing" ? state.summary : null;
  const toApply = summary ? summary.newCount + summary.updateCount : 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      locked={busy}
      size="lg"
      title="Upload scholar details"
      description="CSV or Excel (.xlsx) with the columns Full Name, Matric Number and Email."
      footer={
        summary ? (
          <>
            <Button variant="secondary" onClick={reset} disabled={busy}>
              Choose another file
            </Button>
            <Button onClick={commit} loading={state.phase === "importing"} disabled={toApply === 0}>
              {toApply === 0 ? "Nothing to import" : `Import ${pluralize(toApply, "scholar")}`}
            </Button>
          </>
        ) : (
          <DownloadLink href="/api/admin/scholars/template" variant="secondary">
            <FileDown className="size-4" /> Download CSV template
          </DownloadLink>
        )
      }
    >
      {!summary ? (
        <div className="space-y-4">
          {state.phase === "pick" && state.error && <Alert tone="error">{state.error}</Alert>}
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void check(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              dragging ? "border-brand-500 bg-brand-50/50" : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50",
              state.phase === "checking" && "pointer-events-none opacity-70",
            )}
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-600">
              {state.phase === "checking" ? <FileSpreadsheet className="size-5 animate-pulse" /> : <UploadCloud className="size-5" />}
            </div>
            <p className="mt-4 font-medium">
              {state.phase === "checking" ? `Checking ${state.file.name}…` : "Drop your file here, or click to browse"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">.csv or .xlsx · up to 5 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void check(f);
              }}
            />
          </label>
          <ul className="space-y-1.5 text-sm text-zinc-600">
            <li>• Required columns: <strong>Full Name</strong>, <strong>Matric Number</strong>, <strong>Email</strong>. Other columns (e.g. S/N) are ignored.</li>
            <li>• Existing matric numbers are updated; new ones are added. Nothing is deleted.</li>
            <li>• You&apos;ll see a preview with any problems before anything is saved.</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
            <FileSpreadsheet className="size-5 text-emerald-600" />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{summary.fileName}</p>
              <p className="text-zinc-500">
                {summary.sheetName ? `Sheet “${summary.sheetName}” · ` : ""}
                {pluralize(summary.totalRows, "row")} found
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "New", value: summary.newCount, tone: "text-emerald-700" },
              { label: "Updated", value: summary.updateCount, tone: "text-ink" },
              { label: "Unchanged", value: summary.unchangedCount, tone: "text-zinc-500" },
              { label: "Skipped (errors)", value: summary.errorCount, tone: summary.errorCount ? "text-brand-700" : "text-zinc-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-200 p-3">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={cn("mt-0.5 text-2xl font-bold tabular-nums", s.tone)}>{formatNumber(s.value)}</p>
              </div>
            ))}
          </div>

          {summary.errorCount > 0 && (
            <IssueList
              tone="error"
              title={`${pluralize(summary.errorCount, "row")} will be skipped`}
              issues={summary.errors}
              total={summary.errorCount}
            />
          )}
          {summary.warningCount > 0 && (
            <IssueList tone="warning" title="Warnings" issues={summary.warnings} total={summary.warningCount} />
          )}
          {summary.updates.length > 0 && (
            <details className="rounded-xl border border-zinc-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                {pluralize(summary.updateCount, "existing scholar")} will be updated
              </summary>
              <ul className="max-h-56 divide-y divide-zinc-100 overflow-y-auto border-t border-zinc-100 text-xs">
                {summary.updates.map((u) => (
                  <li key={u.rowNumber} className="px-4 py-2">
                    <span className="font-mono font-medium">{u.matricDisplay}</span>
                    <span className="text-zinc-500"> — {u.changes.join("; ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {summary.newSample.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Preview of new scholars</p>
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full min-w-[480px] text-xs">
                  <thead className="bg-zinc-50 text-left text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Row</th>
                      <th className="px-3 py-2 font-medium">Full Name</th>
                      <th className="px-3 py-2 font-medium">Matric Number</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {summary.newSample.map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="px-3 py-2 text-zinc-400 tabular-nums">{r.rowNumber}</td>
                        <td className="px-3 py-2">{r.fullName}</td>
                        <td className="px-3 py-2 font-mono">{r.matricDisplay}</td>
                        <td className="px-3 py-2">{r.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function IssueList({
  tone,
  title,
  issues,
  total,
}: {
  tone: "error" | "warning";
  title: string;
  issues: Issue[];
  total: number;
}) {
  return (
    <Alert tone={tone} title={title}>
      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto pr-2 text-xs">
        {issues.map((i, idx) => (
          <li key={`${i.rowNumber}-${idx}`}>
            <span className="font-semibold">Row {i.rowNumber}:</span> {i.message}
          </li>
        ))}
        {total > issues.length && <li>…and {formatNumber(total - issues.length)} more</li>}
      </ul>
    </Alert>
  );
}
