"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Download, FileDown, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Alert, Badge, EmptyState } from "@/components/ui/misc";
import { deleteScholar, saveScholar } from "@/app/actions/admin";
import { UploadScholarsDialog } from "./upload-scholars";
import { ReminderDialog } from "./reminders";
import { cn } from "@/lib/utils";
import { DownloadLink } from "@/components/ui/download-link";

export type ScholarRow = {
  id: string;
  fullName: string;
  matric: string;
  email: string;
  voted: boolean;
  votedAt: string | null;
  institution: string | null;
  vcName: string | null;
  reminderCount: number;
  lastRemindedAt: string | null;
};

export function ScholarsHeaderActions({ pendingTotal }: { pendingTotal: number }) {
  const [dialog, setDialog] = useState<null | "add" | "upload" | "remind">(null);
  return (
    <>
      <DownloadLink href="/api/admin/scholars/template" variant="ghost">
        <FileDown className="size-4" /> Template
      </DownloadLink>
      <DownloadLink href="/api/admin/export/scholars" variant="secondary">
        <Download className="size-4" /> Export
      </DownloadLink>
      <Button variant="secondary" onClick={() => setDialog("add")}>
        <Plus className="size-4" /> Add
      </Button>
      <Button variant="dark" onClick={() => setDialog("upload")}>
        <Upload className="size-4" /> Upload
      </Button>
      <Button onClick={() => setDialog("remind")} disabled={pendingTotal === 0}>
        <Bell className="size-4" /> Send reminders
      </Button>
      <ScholarFormDialog open={dialog === "add"} onClose={() => setDialog(null)} />
      <UploadScholarsDialog open={dialog === "upload"} onClose={() => setDialog(null)} />
      <ReminderDialog
        open={dialog === "remind"}
        onClose={() => setDialog(null)}
        pendingTotal={pendingTotal}
        selectedIds={[]}
      />
    </>
  );
}

export function ScholarsTable({
  rows,
  pendingTotal,
  hasFilters,
}: {
  rows: ScholarRow[];
  pendingTotal: number;
  hasFilters: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ScholarRow | null>(null);
  const [deleting, setDeleting] = useState<ScholarRow | null>(null);
  const [remindOpen, setRemindOpen] = useState(false);

  const selectable = rows.filter((r) => !r.voted);
  const visibleSelected = selectable.filter((r) => selected.has(r.id));
  const allSelected = selectable.length > 0 && visibleSelected.length === selectable.length;

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon={<Users className="size-5" />} title={hasFilters ? "No matching scholars" : "No scholars yet"}>
        {hasFilters
          ? "Try a different search or filter."
          : "Upload the scholar details file (Full Name, Matric Number, Email) to get started."}
      </EmptyState>
    );
  }

  return (
    <>
      {visibleSelected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-brand-50/60 px-4 py-2.5">
          <p className="text-sm font-medium">{visibleSelected.length} selected</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setRemindOpen(true)}>
              <Bell className="size-4" /> Remind selected
            </Button>
          </div>
        </div>
      )}
      {/* Phones: one card per scholar */}
      <div className="md:hidden">
        <label className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-xs font-medium text-zinc-600">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={selectable.length === 0}
            onChange={() =>
              setSelected((s) => {
                const next = new Set(s);
                for (const r of selectable) {
                  if (allSelected) next.delete(r.id);
                  else next.add(r.id);
                }
                return next;
              })
            }
            className="size-4 rounded accent-brand-600"
          />
          Select everyone who hasn&apos;t voted on this page
        </label>
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <li key={r.id} className={cn("px-4 py-3.5", selected.has(r.id) && "bg-brand-50/40")}>
              <div className="flex items-start gap-3">
                <span className="mt-1 w-4 shrink-0">
                  {!r.voted && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.fullName}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="size-4 rounded accent-brand-600"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium break-words">{r.fullName}</p>
                    {r.voted ? <Badge tone="success">Voted</Badge> : <Badge tone="warning">Not voted</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs break-all text-zinc-500">{r.email}</p>
                  <p className="mt-1 font-mono text-xs break-all">{r.matric}</p>
                  {r.voted && (
                    <p className="mt-2 rounded-lg bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600">
                      <span className="font-medium text-ink">{r.institution}</span>
                      <br />
                      VC: {r.vcName} · {r.votedAt}
                    </p>
                  )}
                  {r.reminderCount > 0 && (
                    <p className="mt-1.5 text-xs text-zinc-500">
                      {r.reminderCount} reminder{r.reminderCount === 1 ? "" : "s"} sent · last {r.lastRemindedAt}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(r)}
                    className="grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                    aria-label={`Edit ${r.fullName}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(r)}
                    disabled={r.voted}
                    className="grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-30"
                    aria-label={`Delete ${r.fullName}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Tablets and up: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="w-10 py-3 pr-1 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all scholars who haven't voted on this page"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={() =>
                    setSelected((s) => {
                      const next = new Set(s);
                      for (const r of selectable) {
                        if (allSelected) next.delete(r.id);
                        else next.add(r.id);
                      }
                      return next;
                    })
                  }
                  className="size-4 rounded accent-brand-600"
                />
              </th>
              <th className="px-3 py-3 font-medium">Scholar</th>
              <th className="px-3 py-3 font-medium">Matric number</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Vote</th>
              <th className="px-3 py-3 font-medium">Reminders</th>
              <th className="w-24 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id} className={cn("align-top hover:bg-zinc-50/60", selected.has(r.id) && "bg-brand-50/40")}>
                <td className="py-3 pr-1 pl-4">
                  {!r.voted && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.fullName}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="mt-0.5 size-4 rounded accent-brand-600"
                    />
                  )}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium">{r.fullName}</p>
                  <p className="text-xs text-zinc-500">{r.email}</p>
                </td>
                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">{r.matric}</td>
                <td className="px-3 py-3">
                  {r.voted ? (
                    <>
                      <Badge tone="success">Voted</Badge>
                      <p className="mt-1 text-xs whitespace-nowrap text-zinc-500">{r.votedAt}</p>
                    </>
                  ) : (
                    <Badge tone="warning">Not voted</Badge>
                  )}
                </td>
                <td className="max-w-64 px-3 py-3">
                  {r.voted ? (
                    <>
                      <p className="font-medium">{r.institution}</p>
                      <p className="text-xs break-words text-zinc-500">VC: {r.vcName}</p>
                    </>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-zinc-500">
                  {r.reminderCount > 0 ? (
                    <>
                      <p className="font-medium text-zinc-700">{r.reminderCount} sent</p>
                      <p className="whitespace-nowrap">Last {r.lastRemindedAt}</p>
                    </>
                  ) : (
                    "None"
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                      aria-label={`Edit ${r.fullName}`}
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(r)}
                      disabled={r.voted}
                      className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Delete ${r.fullName}`}
                      title={r.voted ? "Scholars who have voted can't be deleted" : "Delete"}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ScholarFormDialog open={!!editing} scholar={editing} onClose={() => setEditing(null)} />
      <DeleteScholarDialog scholar={deleting} onClose={() => setDeleting(null)} />
      <ReminderDialog
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        onSent={() => setSelected(new Set())}
        pendingTotal={pendingTotal}
        selectedIds={visibleSelected.map((r) => r.id)}
        defaultScope="selected"
      />
    </>
  );
}

function ScholarFormDialog({
  open,
  onClose,
  scholar,
}: {
  open: boolean;
  onClose: () => void;
  scholar?: ScholarRow | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const key = scholar?.id ?? "new";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await saveScholar({
        id: scholar?.id,
        fullName: String(fd.get("fullName") ?? ""),
        matric: String(fd.get("matric") ?? ""),
        email: String(fd.get("email") ?? ""),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(scholar ? "Scholar updated" : "Scholar added");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      locked={pending}
      title={scholar ? "Edit scholar" : "Add scholar"}
      description={scholar ? scholar.matric : "Add a single scholar. To add many, use Upload."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="scholar-form" loading={pending}>
            {scholar ? "Save changes" : "Add scholar"}
          </Button>
        </>
      }
    >
      <form id="scholar-form" key={key} onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {scholar?.voted && (
          <Alert tone="info">This scholar has already voted. Their vote stays linked to them after editing.</Alert>
        )}
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={scholar?.fullName} required autoFocus />
        </div>
        <div>
          <Label htmlFor="matric">Matric number</Label>
          <Input id="matric" name="matric" defaultValue={scholar?.matric} required className="font-mono" />
          <FieldHint>Scholars sign in with this. Spaces and letter case are ignored.</FieldHint>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={scholar?.email} required />
          <FieldHint>One-time codes and reminders are sent here.</FieldHint>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteScholarDialog({ scholar, onClose }: { scholar: ScholarRow | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={!!scholar}
      onClose={onClose}
      locked={pending}
      size="sm"
      title="Delete scholar?"
      description={scholar ? `${scholar.fullName} · ${scholar.matric}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                if (!scholar) return;
                const res = await deleteScholar(scholar.id);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Scholar deleted");
                onClose();
                router.refresh();
              })
            }
          >
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">
        They will no longer be able to sign in or vote. You can add them again later.
      </p>
    </Dialog>
  );
}
