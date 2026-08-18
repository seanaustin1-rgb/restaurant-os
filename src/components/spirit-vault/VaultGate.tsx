"use client";

import { useState } from "react";

// Shown when a guest reaches the digital vault without today's access. The vault is
// unlocked on-site by scanning the code on today's tasting placemat; the manual
// entry is a fallback for when the camera won't cooperate.
export function VaultGate({ expired = false }: { expired?: boolean }) {
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (clean.length >= 4) window.location.href = `/v/${clean}`;
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="font-mono text-xs uppercase tracking-[0.28em] text-copper-soft">Spirit Vault</div>
      <h1 className="mt-3 font-display text-3xl text-ink dark:text-parchment">
        {expired ? "That code has expired" : "Unlock today’s vault"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The vault opens on-site. Scan the code on <strong>today’s tasting placemat</strong> at the bar, and the full
        dossier for every pour is yours for the rest of the day.
      </p>

      <form onSubmit={submit} className="mt-8 w-full">
        <label htmlFor="daycode" className="font-mono text-[11px] uppercase tracking-[0.18em] text-copper-soft">
          Or enter today’s code
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="daycode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. K7Q2M9"
            className="flex-1 rounded-md border border-line bg-transparent px-3 py-2 text-center font-mono text-lg tracking-[0.2em] text-ink outline-none focus:border-copper dark:text-parchment"
          />
          <button
            type="submit"
            disabled={clean.length < 4}
            className="rounded-md bg-ink px-4 py-2 font-mono text-sm text-parchment disabled:opacity-40 dark:bg-parchment dark:text-ink"
          >
            Enter
          </button>
        </div>
      </form>

      <p className="mt-6 text-xs text-muted">
        Want your vault anywhere? Off-premise access is coming as a member perk.
      </p>
    </main>
  );
}
