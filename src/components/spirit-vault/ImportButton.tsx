"use client";

import { useRef, useState } from "react";

const CHUNK_SIZE = 20;

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
      const spirits: unknown[] = Array.isArray(data) ? data : data.spirits ?? data;

      // Dry-run the first chunk to validate auth + schema
      setStatus(`Validating ${spirits.length} spirits...`);
      const dryRun = await safeFetch("/admin/spirit-vault/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spirits.slice(0, CHUNK_SIZE)),
      });

      if (!dryRun.ok) {
        setStatus(`Validation failed: ${dryRun.data.errors?.length ?? 0} errors — ${dryRun.data.error ?? ""}`);
        setBusy(false);
        return;
      }

      if (dryRun.data.skipped === dryRun.data.total) {
        setStatus(`First ${CHUNK_SIZE} spirits not found in DB — wrong environment?`);
        setBusy(false);
        return;
      }

      // Commit in chunks
      let totalUpdated = 0;
      let totalDefUpdated = 0;
      let totalSkipped = 0;
      const chunks = Math.ceil(spirits.length / CHUNK_SIZE);

      for (let i = 0; i < spirits.length; i += CHUNK_SIZE) {
        const chunk = spirits.slice(i, i + CHUNK_SIZE);
        const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
        setStatus(`Committing chunk ${chunkNum}/${chunks} (${i + 1}–${Math.min(i + CHUNK_SIZE, spirits.length)} of ${spirits.length})...`);

        const res = await safeFetch("/admin/spirit-vault/import?commit=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk),
        });

        if (!res.ok) {
          setStatus(`Error on chunk ${chunkNum}: ${res.data.error}`);
          setBusy(false);
          return;
        }

        totalUpdated += res.data.updated ?? 0;
        totalDefUpdated += res.data.defUpdated ?? 0;
        totalSkipped += res.data.skipped ?? 0;
      }

      setStatus(`Done: ${totalUpdated} updated, ${totalDefUpdated} definitions, ${totalSkipped} skipped`);
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
