"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Building2, CheckCircle2, Download, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Select } from "@/components/ui/field";
import { Alert, Badge, EmptyState } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import {
  checkInstitutionName,
  deleteInstitution,
  saveInstitution,
  setInstitutionActive,
} from "@/app/actions/admin";
import { CEREMONY_REGIONS, GEOPOLITICAL_ZONES, LIMITS, zoneLabel } from "@/lib/constants";
import type { InstitutionMatch } from "@/lib/institution-match";
import { cn } from "@/lib/utils";
import { DownloadLink } from "@/components/ui/download-link";

export type InstitutionRow = {
  id: string;
  name: string;
  location: string | null;
  geopoliticalZone: string | null;
  ceremonyRegion: string | null;
  isActive: boolean;
  votes: number;
};

export function InstitutionsHeaderActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DownloadLink href="/api/admin/export/institutions" variant="secondary">
        <Download className="size-4" /> Export
      </DownloadLink>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add institution
      </Button>
      <InstitutionDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function InstitutionsTable({ rows, hasFilters }: { rows: InstitutionRow[]; hasFilters: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<InstitutionRow | null>(null);
  const [deleting, setDeleting] = useState<InstitutionRow | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(row: InstitutionRow) {
    setToggling(row.id);
    startTransition(async () => {
      const res = await setInstitutionActive(row.id, !row.isActive);
      setToggling(null);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(row.isActive ? `${row.name} hidden from the ballot` : `${row.name} is back on the ballot`);
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon={<Building2 className="size-5" />} title={hasFilters ? "No matching institutions" : "No institutions yet"}>
        {hasFilters ? "Try a different search or region." : "Add the participating institutions to build the ballot."}
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="divide-y divide-zinc-100 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={cn("px-4 py-3.5", !r.isActive && "bg-zinc-50/80")}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium break-words", !r.isActive && "text-zinc-500")}>{r.name}</p>
                {r.location && <p className="text-xs text-zinc-500">{r.location}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {r.ceremonyRegion ? <Badge>{r.ceremonyRegion}</Badge> : <Badge tone="warning">Region not set</Badge>}
                  {r.geopoliticalZone && <Badge>{zoneLabel(r.geopoliticalZone)}</Badge>}
                  <Badge tone={r.votes ? "dark" : "neutral"}>
                    {r.votes} {r.votes === 1 ? "vote" : "votes"}
                  </Badge>
                </div>
                <label className="mt-3 flex items-center gap-2.5 text-xs font-medium text-zinc-600">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.isActive}
                    aria-label={`${r.name} on ballot`}
                    disabled={toggling === r.id}
                    onClick={() => toggle(r)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                      r.isActive ? "bg-brand-600" : "bg-zinc-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block size-5 rounded-full bg-white shadow transition-transform",
                        r.isActive ? "translate-x-[22px]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                  {r.isActive ? "On the ballot" : "Hidden from the ballot"}
                </label>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                  aria-label={`Edit ${r.name}`}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(r)}
                  disabled={r.votes > 0}
                  className="grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-30"
                  aria-label={`Delete ${r.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Institution</th>
              <th className="px-4 py-3 font-medium">Geopolitical zone</th>
              <th className="px-4 py-3 font-medium">Ceremony region</th>
              <th className="px-4 py-3 text-right font-medium">Votes</th>
              <th className="px-4 py-3 font-medium">On ballot</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id} className={cn("hover:bg-zinc-50/60", !r.isActive && "bg-zinc-50/80 text-zinc-500")}>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{r.name}</p>
                  {r.location && <p className="text-xs text-zinc-500">{r.location}</p>}
                </td>
                <td className="px-4 py-3">{zoneLabel(r.geopoliticalZone) || <span className="text-zinc-400">—</span>}</td>
                <td className="px-4 py-3">
                  {r.ceremonyRegion ? <Badge>{r.ceremonyRegion}</Badge> : <Badge tone="warning">Not set</Badge>}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.votes}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.isActive}
                    aria-label={`${r.name} on ballot`}
                    disabled={toggling === r.id}
                    onClick={() => toggle(r)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                      r.isActive ? "bg-brand-600" : "bg-zinc-300",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block size-5 rounded-full bg-white shadow transition-transform",
                        r.isActive ? "translate-x-[22px]" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-ink"
                      aria-label={`Edit ${r.name}`}
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(r)}
                      disabled={r.votes > 0}
                      className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-brand-50 hover:text-brand-700 disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Delete ${r.name}`}
                      title={r.votes > 0 ? "Has votes — hide it from the ballot instead" : "Delete"}
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
      <InstitutionDialog open={!!editing} institution={editing} onClose={() => setEditing(null)} />
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Delete institution?"
        description={deleting?.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                startTransition(async () => {
                  if (!deleting) return;
                  const res = await deleteInstitution(deleting.id);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Institution deleted");
                    setDeleting(null);
                    router.refresh();
                  }
                })
              }
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">It will be removed from the ballot and the institution list.</p>
      </Dialog>
    </>
  );
}

/** Mounted only while open, so every opening starts from fresh state. */
function InstitutionDialog(props: { open: boolean; onClose: () => void; institution?: InstitutionRow | null }) {
  return props.open ? <InstitutionDialogBody {...props} /> : null;
}

function InstitutionDialogBody({
  open,
  onClose,
  institution,
}: {
  open: boolean;
  onClose: () => void;
  institution?: InstitutionRow | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(institution?.name ?? "");
  const [location, setLocation] = useState(institution?.location ?? "");
  const [zone, setZone] = useState(institution?.geopoliticalZone ?? "");
  const [region, setRegion] = useState(institution?.ceremonyRegion ?? "");
  const [matches, setMatches] = useState<InstitutionMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [confirmSimilar, setConfirmSimilar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Live duplicate check as the admin types (debounced; stale responses are ignored).
  function onNameChange(next: string) {
    setName(next);
    setConfirmSimilar(false);
    clearTimeout(timer.current);
    const id = ++requestId.current;
    const value = next.trim();
    if (value.length < 2 || value === institution?.name) {
      setMatches([]);
      setChecking(false);
      return;
    }
    setChecking(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await checkInstitutionName(value, institution?.id);
        if (id === requestId.current) setMatches(res);
      } catch {
        // The server re-checks on save, so a failed live check is non-fatal.
      } finally {
        if (id === requestId.current) setChecking(false);
      }
    }, 350);
  }

  const exact = matches.find((m) => m.kind === "exact");
  const similar = matches.filter((m) => m.kind !== "exact");
  const blocked = !!exact || (similar.length > 0 && !confirmSimilar);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveInstitution({
        id: institution?.id,
        name,
        location,
        geopoliticalZone: zone,
        ceremonyRegion: region,
        confirmSimilar,
      });
      if (!res.ok) {
        setError(res.error);
        if ("similar" in res) setMatches(res.similar);
        return;
      }
      toast.success(institution ? "Institution updated" : "Institution added");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={pending}
      title={institution ? "Edit institution" : "Add institution"}
      description="Only the name is required. Institutions appear on the ballot in alphabetical order."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="institution-form" loading={pending} disabled={blocked || checking || name.trim().length < 2}>
            {institution ? "Save changes" : "Add institution"}
          </Button>
        </>
      }
    >
      <form id="institution-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && !exact && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="inst-name">Institution name</Label>
          <div className="relative">
            <Input
              id="inst-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              maxLength={LIMITS.institutionNameMax}
              placeholder="e.g. University of Lagos"
              invalid={!!exact}
              autoFocus
              autoComplete="off"
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Spinner className="size-4 text-zinc-400" />
              ) : name.trim().length >= 2 && !matches.length && name.trim() !== institution?.name ? (
                <CheckCircle2 className="size-4 text-emerald-600" aria-label="No duplicates found" />
              ) : null}
            </span>
          </div>
          {exact ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-brand-50 p-2.5 text-sm text-brand-800">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>{exact.name}</strong> already exists. Duplicates can&apos;t be added.
              </span>
            </div>
          ) : similar.length > 0 ? (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="size-4" /> Possible duplicate — please check
              </p>
              <ul className="mt-2 space-y-1">
                {similar.map((m) => (
                  <li key={m.id} className="flex flex-wrap justify-between gap-x-3">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-amber-700">{m.reason}</span>
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-amber-200 pt-3">
                <input
                  type="checkbox"
                  checked={confirmSimilar}
                  onChange={(e) => setConfirmSimilar(e.target.checked)}
                  className="size-4 accent-brand-600"
                />
                This is a different institution — save it anyway
              </label>
            </div>
          ) : (
            <FieldHint>We check for duplicates as you type, including abbreviations and spelling variations.</FieldHint>
          )}
        </div>
        <div>
          <Label htmlFor="inst-location" optional>
            Location
          </Label>
          <Input
            id="inst-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={LIMITS.locationMax}
            placeholder="e.g. Akoka, Lagos State"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="inst-zone" optional>
              Geopolitical zone
            </Label>
            <Select id="inst-zone" value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Not set</option>
              {GEOPOLITICAL_ZONES.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="inst-region" optional>
              Ceremony region
            </Label>
            <Select id="inst-region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">Not set</option>
              {CEREMONY_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {!region && (
          <p className="text-xs text-zinc-500">
            Without a ceremony region, votes for this institution are reported under “Unassigned” in results.
          </p>
        )}
      </form>
    </Dialog>
  );
}
