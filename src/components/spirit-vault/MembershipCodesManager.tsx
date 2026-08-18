"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  generateMembershipCodeAction,
  revokeMembershipCodeAction,
} from "@/app/admin/spirit-vault/membership/actions";

export interface CodeRow {
  id: string;
  hint: string;
  label: string | null;
  status: "ACTIVE" | "REVOKED";
  grantDays: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  createdAt: string;
}
export interface RedemptionRow {
  id: string;
  guestEmail: string | null;
  codeHint: string;
  redeemedAt: string;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function MembershipCodesManager({ codes, redemptions }: { codes: CodeRow[]; redemptions: RedemptionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [singleUse, setSingleUse] = useState(false);
  const [expires, setExpires] = useState("");
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await generateMembershipCodeAction({
          label: label.trim() || null,
          maxRedemptions: singleUse ? 1 : null,
          expiresAt: expires ? new Date(expires).toISOString() : null,
        });
        setMinted(res.plaintext);
        setCopied(false);
        router.refresh();
      } catch {
        setError("Could not generate a code. Please try again.");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeMembershipCodeAction(id);
        router.refresh();
      } catch {
        setError("Could not revoke that code.");
      }
    });
  }

  function resetForm() {
    setOpen(false);
    setMinted(null);
    setLabel("");
    setSingleUse(false);
    setExpires("");
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{codes.length} code{codes.length === 1 ? "" : "s"}</p>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20"
          >
            + Generate code
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-lg border border-line bg-surface p-5">
          {minted ? (
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-copper-soft">Your new code</p>
              <p className="mt-2 select-all font-mono text-2xl font-bold tracking-[0.16em] text-copper-soft">{minted}</p>
              <div className="mt-3 flex justify-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(minted);
                    setCopied(true);
                  }}
                  className="rounded-md border border-copper-dim px-3 py-1.5 font-mono text-xs text-copper-soft hover:bg-copper/10"
                >
                  {copied ? "Copied ✓" : "Copy code"}
                </button>
                <button onClick={resetForm} className="rounded-md bg-ink px-3 py-1.5 font-mono text-xs text-ink-text">
                  Done
                </button>
              </div>
              <p className="mx-auto mt-3 max-w-sm text-xs text-copper-soft">
                ⚠ This is the only time it&apos;s shown. It&apos;s stored hashed — you can revoke it, but it can never be
                displayed again. Copy it into your member&apos;s welcome now.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Label (for your reference)</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Echo's Reserve — 2026 members"
                  className="mt-1 w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm text-ink-text outline-none focus:border-copper"
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                <label className="flex items-center gap-2 text-ink-text">
                  <input type="checkbox" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} />
                  Single-use (one member)
                </label>
                <label className="flex items-center gap-2 text-ink-text">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Code expires</span>
                  <input
                    type="date"
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                    className="rounded-md border border-line bg-transparent px-2 py-1 text-sm text-ink-text outline-none focus:border-copper"
                  />
                </label>
              </div>
              <p className="text-xs text-muted">Grants 1 year of access from redemption. Unlimited redemptions unless single-use.</p>
              <div className="flex gap-2">
                <button
                  onClick={generate}
                  disabled={pending}
                  className="rounded-md bg-ink px-4 py-2 text-sm text-ink-text disabled:opacity-50"
                >
                  {pending ? "Generating…" : "Generate"}
                </button>
                <button onClick={resetForm} className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-ink-text">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-health-red">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Redemptions</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  No codes yet. Generate one to hand a member.
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-mono text-copper-soft">{c.hint}</div>
                  {c.label && <div className="mt-0.5 text-xs text-muted">{c.label}</div>}
                </td>
                <td className="tnum px-3 py-2 text-muted">
                  {c.redemptionCount} / {c.maxRedemptions ?? "∞"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.status === "ACTIVE"
                        ? "rounded-full border border-emerald-700/40 bg-emerald-900/20 px-2 py-0.5 text-[11px] text-emerald-300"
                        : "rounded-full border border-red-800/40 bg-red-900/20 px-2 py-0.5 text-[11px] text-red-300"
                    }
                  >
                    {c.status === "ACTIVE" ? "Active" : "Revoked"}
                  </span>
                </td>
                <td className="tnum px-3 py-2 text-muted">{fmtDate(c.expiresAt)}</td>
                <td className="px-3 py-2 text-right">
                  {c.status === "ACTIVE" ? (
                    <button
                      onClick={() => revoke(c.id)}
                      disabled={pending}
                      className="rounded-md border border-line px-3 py-1 font-mono text-[11px] text-muted hover:border-health-red hover:text-health-red disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] text-muted/60">Revoked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Recent redemptions</h2>
        {redemptions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No redemptions yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line/60">
            {redemptions.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-mono text-xs text-ink-text">{r.guestEmail ?? "a member"}</span>
                <span className="text-muted">redeemed</span>
                <span className="font-mono text-xs text-copper-soft">{r.codeHint}</span>
                <span className="ml-auto font-mono text-xs text-muted">{fmtDate(r.redeemedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
