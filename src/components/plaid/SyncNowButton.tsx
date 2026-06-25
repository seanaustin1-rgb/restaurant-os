"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function SyncNowButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg("Syncing…");

    let totalAdded = 0;
    // The first sync of a real account can span many pages of history. Each call
    // processes as much as it can within its time budget and tells us whether
    // more remains; keep calling until it's done. A page cap guards against loops.
    try {
      for (let i = 0; i < 50; i++) {
        const res = await fetch("/api/plaid/sync", { method: "POST" });
        const d = await res.json();
        if (!res.ok && !d.added && !d.hasMore) {
          throw new Error(d.error || "sync failed");
        }
        totalAdded += d.added ?? 0;
        if (d.warning) {
          setMsg(`Synced ${totalAdded} new transaction(s). ${d.warning}`);
        } else if (d.hasMore) {
          setMsg(`Syncing… ${totalAdded} transactions so far`);
        }
        if (!d.hasMore) break;
      }
      setMsg(`Done — imported ${totalAdded} new transaction(s).`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      setBusy(false);
      setMsg(e instanceof Error ? `Couldn't run sync: ${e.message}` : "Couldn't run sync.");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink-text hover:border-copper-dim disabled:opacity-40"
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
