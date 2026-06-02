"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { money2 } from "@/lib/format";

interface Candidate {
  date: string;
  description: string;
  amount: number;
}

type Status = "idle" | "parsing" | "parsed" | "importing" | "done" | "error";

export function StatementUploader() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [preview, setPreview] = useState<string>("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const [method, setMethod] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setError(null);
    setExcluded(new Set());
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await fetch("/api/import", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't parse statement");
      setCandidates(j.candidates ?? []);
      setPreview(j.textPreview ?? "");
      setMethod(j.method ?? null);
      setWarning(j.warning ?? null);
      setStatus("parsed");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function doImport() {
    const selected = candidates.filter((_, i) => !excluded.has(i));
    setStatus("importing");
    try {
      const r = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: selected }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed");
      setImportedCount(j.imported ?? 0);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  function toggle(i: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const selectedCount = candidates.length - excluded.size;

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-sm text-muted hover:border-copper-dim">
        <Upload size={18} className="text-copper" />
        {status === "parsing" ? "Reading statement…" : "Choose a bank statement PDF"}
        <input type="file" accept="application/pdf" className="hidden" onChange={onFile} disabled={status === "parsing"} />
      </label>

      {error && <p className="text-sm text-health-red">{error}</p>}
      {warning && <p className="text-sm text-health-yellow">{warning}</p>}

      {status === "done" && (
        <div className="rounded-lg border border-health-green/40 bg-health-green/10 px-4 py-3 text-sm text-health-green">
          Imported {importedCount} transactions. <a href="/dashboard" className="underline">View dashboard →</a>
        </div>
      )}

      {(status === "parsed" || status === "importing") && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Found <span className="text-[#E6E8E4]">{candidates.length}</span> candidate transactions
              {candidates.length > 0 && ` · ${selectedCount} selected`}
              {method === "llm" && (
                <span className="ml-2 rounded bg-copper/15 px-1.5 py-0.5 text-[10px] text-copper-soft">AI-extracted</span>
              )}
            </p>
            {candidates.length > 0 && (
              <button
                onClick={doImport}
                disabled={status === "importing" || selectedCount === 0}
                className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
              >
                {status === "importing" ? "Importing…" : `Import ${selectedCount}`}
              </button>
            )}
          </div>

          {candidates.length > 0 ? (
            <div className="max-h-96 overflow-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2"></th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="px-3 py-1.5">
                        <input type="checkbox" checked={!excluded.has(i)} onChange={() => toggle(i)} />
                      </td>
                      <td className="tnum px-3 py-1.5 text-muted">{c.date}</td>
                      <td className="px-3 py-1.5 text-[#E6E8E4]">{c.description}</td>
                      <td className="tnum px-3 py-1.5 text-right text-[#E6E8E4]">{money2(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
              <p className="mb-2 flex items-center gap-2 text-[#E6E8E4]">
                <FileText size={15} /> No transactions detected by the generic parser.
              </p>
              <p>Here&apos;s the raw text we extracted — share it (or the statement) so the parser can be tuned to your bank&apos;s format:</p>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-ink p-3 text-[11px] text-muted">{preview}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
