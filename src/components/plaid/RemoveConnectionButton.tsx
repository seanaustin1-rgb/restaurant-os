"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

// Disconnects a bank connection. Confirms first, since this also deletes the
// transactions that came from that connection.
export function RemoveConnectionButton({
  connectionId,
  institution,
}: {
  connectionId: string;
  institution: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    const ok = window.confirm(
      `Disconnect ${institution}? This removes the connection and the transactions it imported. ` +
        `You can re-connect afterward and choose just the account(s) you want.`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    fetch(`/api/plaid/connection/${connectionId}`, { method: "DELETE" })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Couldn't remove connection");
        }
      })
      .then(() => window.location.reload())
      .catch((e) => {
        setBusy(false);
        setError(e instanceof Error ? e.message : "Couldn't remove connection");
      });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={remove}
        disabled={busy}
        aria-label={`Disconnect ${institution}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:border-health-red hover:text-health-red disabled:opacity-40"
      >
        <Trash2 size={13} />
        {busy ? "Removing…" : "Disconnect"}
      </button>
      {error && <span className="text-[11px] text-health-red">{error}</span>}
    </div>
  );
}
