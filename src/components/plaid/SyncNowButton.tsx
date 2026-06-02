"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function SyncNowButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function sync() {
    setBusy(true);
    setMsg(null);
    fetch("/api/plaid/sync", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        setMsg(d.warning ? d.warning : `Sync triggered for ${d.triggered ?? 0} connection(s).`);
        // Give the background job a moment, then refresh to show new data.
        setTimeout(() => window.location.reload(), 1500);
      })
      .catch(() => {
        setBusy(false);
        setMsg("Couldn't trigger sync.");
      });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-[#E6E8E4] hover:border-copper-dim disabled:opacity-40"
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
