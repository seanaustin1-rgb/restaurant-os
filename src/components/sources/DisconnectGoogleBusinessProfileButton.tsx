"use client";

import { useState } from "react";
import { Unplug } from "lucide-react";

export function DisconnectGoogleBusinessProfileButton({
  connectionId,
  label,
}: {
  connectionId: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function disconnect() {
    const ok = window.confirm(
      `Disconnect Google Business Profile for ${label}? Aura will stop syncing calls, directions, website clicks, and profile views until Google is authorized again.`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    fetch(`/api/google-business-profile/connection/${connectionId}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not disconnect Google.");
        }
      })
      .then(() => window.location.reload())
      .catch((err) => {
        setBusy(false);
        setError(err instanceof Error ? err.message : "Could not disconnect Google.");
      });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={disconnect}
        disabled={busy}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-health-red hover:text-health-red disabled:opacity-50"
      >
        <Unplug size={13} />
        {busy ? "Disconnecting..." : "Disconnect Google"}
      </button>
      {error && <span className="text-[11px] text-health-red">{error}</span>}
    </div>
  );
}
