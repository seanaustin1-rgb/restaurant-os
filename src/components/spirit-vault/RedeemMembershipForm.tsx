"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { redeemMembershipCodeAction, type RedeemActionResult } from "@/app/vault/actions";

const MESSAGES: Record<string, string> = {
  not_found: "We don't recognize that code. Double-check it and try again.",
  revoked: "That code is no longer active. Ask the bar for a current one.",
  expired: "That code has expired. Ask the bar for a current one.",
  exhausted: "That code has already been fully used.",
  already_redeemed: "You've already redeemed this code — you're set.",
  empty: "Enter your membership code.",
  unauthenticated: "Please sign in first.",
  unconfigured: "Memberships aren't available right now.",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function RedeemMembershipForm() {
  const [code, setCode] = useState("");
  const [optIn, setOptIn] = useState(true);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{ until: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clean = code.toUpperCase().replace(/[^0-9A-Z-]/g, "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res: RedeemActionResult = await redeemMembershipCodeAction(clean, optIn);
      if (res.ok) setDone({ until: res.currentPeriodEnd });
      else setError(MESSAGES[res.reason] ?? "Something went wrong. Try again.");
    });
  }

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-copper-dim bg-copper/10 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-copper text-2xl text-copper-soft">
          ✓
        </div>
        <h2 className="mt-3 font-display text-2xl text-copper-soft">You&apos;re a member</h2>
        <p className="mt-2 text-sm text-ink-text-soft">
          Full vault access — anywhere — through <span className="font-semibold text-ink-text">{fmt(done.until)}</span>.
        </p>
        <Link
          href="/vault"
          className="mt-5 inline-block rounded-md bg-copper px-5 py-2.5 font-mono text-sm text-ink"
        >
          Enter the Vault
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8">
      <label htmlFor="mcode" className="font-mono text-[11px] uppercase tracking-[0.16em] text-copper-soft">
        Your membership code
      </label>
      <input
        id="mcode"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="RSRV-XXXX-XXXX"
        className="mt-2 w-full rounded-md border border-line bg-transparent px-4 py-3 text-center font-mono text-lg tracking-[0.16em] text-ink-text outline-none focus:border-copper"
      />
      <label className="mt-4 flex items-start gap-2 text-left text-xs text-ink-text-soft">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5" />
        <span>Keep me posted on new pours, flights &amp; member events.</span>
      </label>
      <button
        type="submit"
        disabled={pending || clean.length < 4}
        className="mt-3 w-full rounded-md bg-copper px-5 py-3 font-mono text-sm text-ink disabled:opacity-40"
      >
        {pending ? "Checking…" : "Redeem membership"}
      </button>
      {error && <p className="mt-3 text-center text-sm text-health-red">{error}</p>}
      <p className="mt-4 text-center text-xs text-muted">Your code came with your Echo&apos;s Reserve membership.</p>
    </form>
  );
}
