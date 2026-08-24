"use client";

import { useRef, useState } from "react";

export function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function safeFetch(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    try {
      return { ok: res.ok, data: JSON.parse(text) };
    } catch {
      return { ok: false, data: { error: `Server error (${res.status}): ${text.slice(0, 120)}` } };
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setStatus("Validating...");

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const spirits = Array.isArray(data) ? data : data.spirits ?? data;

      setStatus(`Dry run: ${spirits.length} spirits...`);
      const dryRun = await safeFetch("/admin/spirit-vault/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spirits),
      });

      if (!dryRun.ok) {
        setStatus(`Validation failed: ${dryRun.data.errors?.length ?? 0} errors — ${dryRun.data.error ?? ""}`);
        setBusy(false);
        return;
      }

      if (dryRun.data.skipped === dryRun.data.total) {
        setStatus(`All ${dryRun.data.total} spirits skipped (not found in DB)`);
        setBusy(false);
        return;
      }

      setStatus(`Committing ${dryRun.data.updated} spirits...`);
      const commitRun = await safeFetch("/admin/spirit-vault/import?commit=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spirits),
      });

      if (!commitRun.ok) {
        setStatus(`Error: ${commitRun.data.error}`);
      } else {
        setStatus(
          `Done: ${commitRun.data.updated} updated, ${commitRun.data.defUpdated} definitions, ${commitRun.data.skipped} skipped`
        );
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-muted hover:text-ink-text disabled:opacity-50"
      >
        {busy ? "Importing..." : "Import JSON"}
      </button>
      {status && <span className="text-xs text-muted">{status}</span>}
    </div>
  );
}
