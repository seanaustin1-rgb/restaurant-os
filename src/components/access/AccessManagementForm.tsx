"use client";

import { useState, useTransition } from "react";
import type { UserRole } from "@prisma/client";
import { Check, Save, Trash2 } from "lucide-react";
import { removeAccessRole, saveAccessRole } from "@/app/settings/access/actions";

type AccessRow = {
  id: string;
  clerkUserId: string;
  role: UserRole;
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
  currentUserId,
}: {
  rows: AccessRow[];
  currentUserId: string;
}) {
  const [clerkUserId, setClerkUserId] = useState("");
  const [role, setRole] = useState<UserRole>("INVESTOR");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveAccessRole({ clerkUserId, role });
        setClerkUserId("");
        setRole("INVESTOR");
        setSaved(true);
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

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-sm text-health-red">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-text">Add or update access</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          First version uses Clerk user IDs. Email invites can layer on top once invite delivery is wired in.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <input
            value={clerkUserId}
            onChange={(e) => {
              setClerkUserId(e.target.value);
              setSaved(false);
            }}
            placeholder="Clerk user ID"
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
            onClick={save}
            disabled={pending || !clerkUserId.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {pending ? "Saving..." : saved ? "Saved" : "Save access"}
          </button>
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
