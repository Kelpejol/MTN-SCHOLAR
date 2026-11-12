"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, KeyRound, Mail, PauseCircle, PlayCircle, Shield, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldHint, Input, Label } from "@/components/ui/field";
import { Alert, Badge, Card } from "@/components/ui/misc";
import {
  changeOwnPassword,
  createAdmin,
  removeAdmin,
  sendTestEmail,
  setVotingPaused,
  updateVotingWindow,
} from "@/app/actions/admin";

function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-700">{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function VotingWindowCard({
  opensAt,
  closesAt,
  isPaused,
  state,
  message,
}: {
  opensAt: string;
  closesAt: string;
  isPaused: boolean;
  state: "open" | "scheduled" | "closed" | "paused";
  message: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(opensAt);
  const [close, setClose] = useState(closesAt);
  const [confirmPause, setConfirmPause] = useState(false);
  const [saving, startSave] = useTransition();
  const [toggling, startToggle] = useTransition();
  const dirty = open !== opensAt || close !== closesAt;

  const tone = { open: "success", scheduled: "warning", paused: "warning", closed: "neutral" } as const;
  const label = { open: "Open", scheduled: "Scheduled", paused: "Paused", closed: "Closed" };

  return (
    <SettingsCard
      icon={<CalendarClock className="size-5" />}
      title="Voting window"
      description="Times are West Africa Time (WAT, UTC+1). Scholars can only sign in and vote inside this window."
    >
      <div className="mb-5 flex items-center gap-2 text-sm">
        <Badge tone={tone[state]}>{label[state]}</Badge>
        <span className="text-zinc-600">{message}</span>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          startSave(async () => {
            const res = await updateVotingWindow({ opensAt: open, closesAt: close });
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Voting window saved");
              router.refresh();
            }
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="opensAt">Opens (WAT)</Label>
            <Input id="opensAt" type="datetime-local" value={open} onChange={(e) => setOpen(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="closesAt">Closes (WAT)</Label>
            <Input id="closesAt" type="datetime-local" value={close} onChange={(e) => setClose(e.target.value)} required />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="dark" loading={saving} disabled={!dirty}>
            Save window
          </Button>
          <Button
            variant={isPaused ? "primary" : "danger"}
            loading={toggling}
            onClick={() => (isPaused ? startToggle(async () => {
              const res = await setVotingPaused(false);
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Voting resumed");
                router.refresh();
              }
            }) : setConfirmPause(true))}
          >
            {isPaused ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
            {isPaused ? "Resume voting" : "Pause voting"}
          </Button>
        </div>
      </form>
      <Dialog
        open={confirmPause}
        onClose={() => setConfirmPause(false)}
        size="sm"
        title="Pause voting?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmPause(false)}>
              Cancel
            </Button>
            <Button
              loading={toggling}
              onClick={() =>
                startToggle(async () => {
                  const res = await setVotingPaused(true);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Voting paused");
                    setConfirmPause(false);
                    router.refresh();
                  }
                })
              }
            >
              Pause voting
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">
          Scholars won&apos;t be able to sign in or submit votes until you resume. Votes already cast are kept.
        </p>
      </Dialog>
    </SettingsCard>
  );
}

export function EmailCard({
  fromAddress,
  fromName,
  configured,
  dryRun,
  appUrl,
  defaultTo,
}: {
  fromAddress: string;
  fromName: string;
  configured: boolean;
  dryRun: boolean;
  appUrl: string;
  defaultTo: string;
}) {
  const [to, setTo] = useState(defaultTo);
  const [pending, startTransition] = useTransition();
  return (
    <SettingsCard icon={<Mail className="size-5" />} title="Email delivery" description="One-time codes, receipts and reminders are sent through ZeptoMail.">
      <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">From</dt>
          <dd className="font-medium break-all">
            {fromName} &lt;{fromAddress}&gt;
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd>
            {dryRun ? (
              <Badge tone="warning">Dev mode — nothing is sent; emails print to the server log</Badge>
            ) : configured ? (
              <Badge tone="success">ZeptoMail connected</Badge>
            ) : (
              <Badge tone="brand">Not configured</Badge>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Links and logos in emails point to</dt>
          <dd className="font-medium break-all">{appUrl}</dd>
        </div>
      </dl>
      {!configured && !dryRun && (
        <Alert tone="error" className="mb-4">
          Set <code className="font-mono">ZEPTOMAIL_TOKEN</code> in the server environment — scholars can&apos;t receive codes until you do.
        </Alert>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await sendTestEmail(to);
            if (!res.ok) toast.error(res.error, { duration: 10000 });
            else toast.success(`Test email sent to ${to}`);
          });
        }}
      >
        <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send test email to" required />
        <Button type="submit" variant="secondary" loading={pending} className="shrink-0">
          Send test email
        </Button>
      </form>
    </SettingsCard>
  );
}

type AdminRow = { id: string; name: string; email: string; lastLogin: string | null };

export function AdminsCard({ admins, meId }: { admins: AdminRow[]; meId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdminRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <SettingsCard icon={<Shield className="size-5" />} title="Admin accounts" description="People who can sign in to this console.">
      <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium">
                {a.name} {a.id === meId && <Badge>You</Badge>}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {a.email} · {a.lastLogin ? `Last sign-in ${a.lastLogin}` : "Never signed in"}
              </p>
            </div>
            {a.id !== meId && (
              <button
                type="button"
                onClick={() => setRemoving(a)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-brand-50 hover:text-brand-700"
                aria-label={`Remove ${a.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <Button variant="secondary" className="mt-4" onClick={() => setAdding(true)}>
        <UserPlus className="size-4" /> Add admin
      </Button>

      <Dialog
        open={adding}
        onClose={() => {
          setAdding(false);
          setError(null);
        }}
        locked={pending}
        title="Add admin"
        description="They'll sign in at /admin with this email and password."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="add-admin" loading={pending}>
              Add admin
            </Button>
          </>
        }
      >
        <form
          id="add-admin"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setError(null);
            startTransition(async () => {
              const res = await createAdmin({
                name: String(fd.get("name") ?? ""),
                email: String(fd.get("email") ?? ""),
                password: String(fd.get("password") ?? ""),
              });
              if (!res.ok) setError(res.error);
              else {
                toast.success("Admin added");
                setAdding(false);
                router.refresh();
              }
            });
          }}
        >
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <Label htmlFor="admin-name">Name</Label>
            <Input id="admin-name" name="name" required autoFocus />
          </div>
          <div>
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="admin-password">Temporary password</Label>
            <Input id="admin-password" name="password" type="password" minLength={10} required autoComplete="new-password" />
            <FieldHint>At least 10 characters. Share it securely and ask them to change it.</FieldHint>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        locked={pending}
        size="sm"
        title="Remove admin?"
        description={removing ? `${removing.name} · ${removing.email}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!removing) return;
                  const res = await removeAdmin(removing.id);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Admin removed");
                    setRemoving(null);
                    router.refresh();
                  }
                })
              }
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-600">They will lose access to the admin console immediately.</p>
      </Dialog>
    </SettingsCard>
  );
}

export function PasswordCard() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsCard icon={<KeyRound className="size-5" />} title="Your password">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const next = String(fd.get("next") ?? "");
          if (next !== String(fd.get("confirm") ?? "")) {
            setError("New passwords don't match.");
            return;
          }
          setError(null);
          startTransition(async () => {
            const res = await changeOwnPassword({ current: String(fd.get("current") ?? ""), next });
            if (!res.ok) setError(res.error);
            else {
              toast.success("Password updated");
              form.reset();
            }
          });
        }}
      >
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="current">Current password</Label>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="next">New password</Label>
            <Input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
          </div>
        </div>
        <Button type="submit" variant="dark" loading={pending}>
          Update password
        </Button>
      </form>
    </SettingsCard>
  );
}
