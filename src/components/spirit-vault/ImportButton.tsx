"use client";

import { useRef, useState } from "react";

export function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setStatus("Validating...");

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const spirits = Array.isArray(data) ? data : data.spirits ?? data;

      // Dry run first
      setStatus(`Dry run: ${spirits.length} spirits...`);
      const dryRes = await fetch("/admin/spirit-vault/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spirits),
      });
      const dryResult = await dryRes.json();

      if (!dryRes.ok) {
        setStatus(`Validation failed: ${dryResult.errors?.length ?? 0} errors`);
        setBusy(false);
        return;
      }

      if (dryResult.skipped === dryResult.total) {
        setStatus(`All ${dryResult.total} spirits skipped (not found in DB)`);
        setBusy(false);
        return;
      }

      // Commit
      setStatus(`Committing ${dryResult.updated} spirits...`);
      const commitRes = await fetch("/admin/spirit-vault/import?commit=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spirits),
      });
      const commitResult = await commitRes.json();

      if (!commitRes.ok) {
        setStatus(`Error: ${commitResult.error}`);
      } else {
        setStatus(
          `Done: ${commitResult.updated} updated, ${commitResult.defUpdated} definitions, ${commitResult.skipped} skipped`
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
