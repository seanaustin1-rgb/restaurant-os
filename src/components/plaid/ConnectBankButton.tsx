"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  type PlaidLinkError,
  type PlaidLinkOnSuccessMetadata,
} from "react-plaid-link";
import { Landmark } from "lucide-react";

type Status = "loading" | "ready" | "connecting" | "error";

export function ConnectBankButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(() => {
    setStatus("loading");
    setError(null);
    fetch("/api/plaid/link-token", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.link_token) throw new Error(d.error || "Couldn't start Plaid Link");
        setLinkToken(d.link_token);
        setStatus("ready");
      })
      .catch((e) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Couldn't start Plaid Link");
      });
  }, []);

  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  const onSuccess = useCallback((publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
    setStatus("connecting");
    setError(null);
    fetch("/api/plaid/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        public_token: publicToken,
        institution: metadata.institution?.name ?? null,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Connection failed");
        }
      })
      .then(() => window.location.reload())
      .catch((e) => {
        setStatus("ready");
        setError(e instanceof Error ? e.message : "Connection failed");
      });
  }, []);

  const onExit = useCallback((err: PlaidLinkError | null) => {
    if (err) setError(err.display_message || err.error_message || "Link closed before finishing");
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess, onExit });

  const label =
    status === "connecting" ? "Connecting…" : status === "loading" ? "Preparing…" : "Connect bank account";

  return (
    <div className="space-y-2">
      <button
        onClick={() => open()}
        disabled={!ready || status === "connecting" || status === "loading"}
        className="inline-flex items-center gap-2 rounded-md bg-copper px-4 py-2.5 font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
      >
        <Landmark size={16} />
        {label}
      </button>
      {error && (
        <p className="text-xs text-health-red">
          {error}
          {status === "error" && (
            <button onClick={fetchToken} className="ml-2 underline hover:no-underline">
              retry
            </button>
          )}
        </p>
      )}
    </div>
  );
}
