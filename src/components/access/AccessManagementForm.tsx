"use client";

import { useState, useTransition } from "react";
import type { UserRole } from "@prisma/client";
import { Check, Copy, Mail, Save, Trash2 } from "lucide-react";
import { inviteAccessByEmail, removeAccessRole, revokeAccessInvite, saveAccessRole } from "@/app/settings/access/actions";

type AccessRow = {
  id: string;
  clerkUserId: string;
  role: UserRole;
  createdAt: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: UserRole;
  inviteUrl: string;
  createdAt: string;
};

const ROLE_OPTIONS: { role: UserRole; label: string; detail: string }[] = [
  {
    role: "OPERATOR",
    label: "Owner / operator",
    detail: "Controls access, authorizes sensitive connections, and can adjust setup.",
  },
  {
    role: "CONSULTANT",
    label: "Consultant / accountant",
    detail: "Can tune setup assumptions, source plans, and advisory views without owning authorizations.",
  },
  {
    role: "INVESTOR",
    label: "Investor",
    detail: "Guaranteed read-only matrix access. No source, settings, or money-movement controls.",
  },
  {
    role: "MANAGER",
    label: "Manager",
    detail: "Can help operate and clean up day-to-day settings, without investor or owner controls.",
  },
];

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : "Could not update access.";
}

export function AccessManagementForm({
  rows,
  invites,
  currentUserId,
}: {
  rows: AccessRow[];
  invites: InviteRow[];
  currentUserId: string;
}) {
  const [email, setEmail] = useState("");
  const [clerkUserId, setClerkUserId] = useState("");
  const [role, setRole] = useState<UserRole>("INVESTOR");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function invite() {
    setError(null);
    setNotice(null);
    setLastInviteUrl(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = await inviteAccessByEmail({ email, role });
        setEmail("");
        setRole("INVESTOR");
        setNotice(result.note ?? (result.status === "granted" ? "Access granted." : "Invite created."));
        setLastInviteUrl(result.inviteUrl ?? null);
        setSaved(true);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function saveDirect() {
    setError(null);
    setNotice(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveAccessRole({ clerkUserId, role });
        setClerkUserId("");
        setRole("INVESTOR");
        setSaved(true);
        setNotice("Access saved by Clerk user ID.");
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function remove(row: AccessRow) {
    const ok = window.confirm(`Remove ${row.role.toLowerCase()} access for ${row.clerkUserId}?`);
    if (!ok) return;
    setError(null);
    setSaved(false);
    setBusyId(row.id);
    startTransition(async () => {
      try {
        await removeAccessRole({ roleId: row.id });
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusyId(null);
      }
    });
  }

  function revoke(invite: InviteRow) {
    const ok = window.confirm(`Revoke the pending invite for ${invite.email}?`);
    if (!ok) return;
    setError(null);
    setNotice(null);
    setBusyId(invite.id);
    startTransition(async () => {
      try {
        await revokeAccessInvite({ inviteId: invite.id });
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusyId(null);
      }
    });
  }

  function copyInvite(url: string) {
    void navigator.clipboard?.writeText(url);
    setNotice("Invite link copied.");
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-sm text-health-red">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-health-green/40 bg-health-green/10 px-3 py-2 text-sm text-health-green">
          {notice}
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Invite by email</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          If the email already has an account, access is granted immediately. Otherwise an invite link is created and
          emailed when transactional email is configured.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSaved(false);
            }}
            placeholder="person@example.com"
            className="min-w-0 rounded-md border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as UserRole);
              setSaved(false);
            }}
            className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={invite}
            disabled={pending || !email.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
          >
            {saved ? <Check size={14} /> : <Mail size={14} />}
            {pending ? "Saving..." : saved ? "Saved" : "Invite"}
          </button>
        </div>
        {lastInviteUrl && (
          <div className="mt-3 rounded-md border border-line bg-ink/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-muted">Manual invite link</p>
            <button
              type="button"
              onClick={() => copyInvite(lastInviteUrl)}
              className="mt-1 inline-flex max-w-full items-center gap-1.5 text-left text-xs text-copper-soft hover:text-copper"
            >
              <Copy size={13} />
              <span className="truncate">{lastInviteUrl}</span>
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Pending email invites</h2>
        <div className="mt-3 space-y-2">
          {invites.length === 0 && (
            <div className="rounded-md border border-dashed border-line p-4 text-center text-sm text-muted">
              No pending invites.
            </div>
          )}
          {invites.map((invite) => {
            const roleOption = ROLE_OPTIONS.find((option) => option.role === invite.role);
            return (
              <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-ink/40 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-text">{invite.email}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {roleOption?.label ?? invite.role} · invited {invite.createdAt}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyInvite(invite.inviteUrl)}
                    className="mt-1 inline-flex max-w-full items-center gap-1.5 text-left text-xs text-copper-soft hover:text-copper"
                  >
                    <Copy size={13} />
                    <span className="truncate">{invite.inviteUrl}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(invite)}
                  disabled={pending || busyId === invite.id}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-health-red hover:text-health-red disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  {busyId === invite.id ? "Revoking..." : "Revoke"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Role guide</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {ROLE_OPTIONS.map((option) => (
            <div key={option.role} className="rounded-md border border-line bg-ink/40 px-3 py-3">
              <p className="text-sm text-ink-text">{option.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{option.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Advanced direct grant</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Use this only when you already know the person&apos;s Clerk user ID.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <input
            value={clerkUserId}
            onChange={(e) => setClerkUserId(e.target.value)}
            placeholder="Clerk user ID"
            className="min-w-0 rounded-md border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.role} value={option.role}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={saveDirect}
            disabled={pending || !clerkUserId.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
          >
            <Save size={14} />
            Save direct
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink-text">Current access</h2>
          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            {rows.length} total
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row) => {
            const roleOption = ROLE_OPTIONS.find((option) => option.role === row.role);
            const isSelf = row.clerkUserId === currentUserId;
            return (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-ink/40 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-text">
                    {row.clerkUserId}
                    {isSelf && <span className="ml-2 text-[10px] uppercase tracking-wider text-copper-soft">you</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {roleOption?.label ?? row.role} · added {row.createdAt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(row)}
                  disabled={pending || busyId === row.id || isSelf}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-health-red hover:text-health-red disabled:opacity-40"
                >
                  <Trash2 size={13} />
                  {busyId === row.id ? "Removing..." : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
