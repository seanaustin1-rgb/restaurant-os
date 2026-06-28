"use client";

import { useState } from "react";

const SAMPLE = `{
  "agents": [
    { "externalAgentId": "A-1", "name": "Dana Reyes", "defaultSplitPct": 70, "annualCap": 24000, "capPaid": 18500 },
    { "externalAgentId": "A-2", "name": "Sam Okafor", "defaultSplitPct": 80, "annualCap": 18000, "capPaid": 6000 }
  ],
  "deals": [
    { "externalDealId": "D-101", "agentExternalId": "A-1", "label": "412 Oak St", "stage": "CLOSED",
      "closedDate": "2026-05-20", "salePrice": 350000, "gci": 8750, "agentSplitPct": 70, "franchiseFee": 525, "referralFee": 0 },
    { "externalDealId": "D-102", "agentExternalId": "A-2", "label": "88 Harbor Ave", "stage": "PENDING",
      "expectedCloseDate": "2026-07-15", "salePrice": 420000, "gci": 10500, "agentSplitPct": 80, "probabilityPct": 80 }
  ],
  "leadSpend": [
    { "agentExternalId": "A-1", "source": "Zillow", "periodStart": "2026-05-01", "periodEnd": "2026-05-31",
      "spend": 1500, "attributedGci": 8750, "attributedDeals": 1 }
  ]
}`;

type Summary = {
  agents: number;
  deals: number;
  leadSpend: number;
  accepted: number;
  rejected: number;
  missingAgentReferences: string[];
};

type PreviewResponse = { summary: Summary; rejected: string[] };
type CommitResponse = { imported: number; summary: Summary; rejected: string[] };

export function BrokerageImportPilot() {
  const [text, setText] = useState(SAMPLE);
  const [busy, setBusy] = useState<null | "preview" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);

  function parsed(): unknown | null {
    try {
      return JSON.parse(text);
    } catch {
      setError("That is not valid JSON. Map your export to the sample shape first.");
      return null;
    }
  }

  async function call(path: "preview" | "commit") {
    const payload = parsed();
    if (payload == null) return;
    setBusy(path);
    setError(null);
    if (path === "preview") setCommitted(null);
    try {
      const res = await fetch(`/api/brokerage/import/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Import failed.");
        return;
      }
      if (path === "preview") setResult(data as PreviewResponse);
      else setCommitted(data as CommitResponse);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(null);
    }
  }

  const summary = committed?.summary ?? result?.summary ?? null;

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={14}
        className="tnum w-full rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-[12px] text-ink-text outline-none focus:border-copper-soft"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => call("preview")}
          disabled={busy != null}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink-text hover:border-copper-dim disabled:opacity-50"
        >
          {busy === "preview" ? "Previewing…" : "Preview"}
        </button>
        <button
          onClick={() => call("commit")}
          disabled={busy != null || result == null}
          className="rounded-lg bg-copper px-4 py-2 text-sm font-medium text-ink transition hover:bg-copper-soft disabled:opacity-50"
        >
          {busy === "commit" ? "Importing…" : "Commit import"}
        </button>
        {result == null && <span className="text-[11px] text-muted">Preview first — nothing is saved until you commit.</span>}
      </div>

      {error && <p className="text-sm text-health-red">{error}</p>}

      {committed && (
        <div className="rounded-lg border border-health-green/30 bg-health-green/10 px-4 py-3 text-sm text-ink-text">
          Imported <span className="tnum">{committed.imported}</span> rows into the clean brokerage tables. The
          Company Dollar, Commission Pipeline, Agent Performance, and Lead ROI tiles now read live data.
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            <Stat label="Agents" value={summary.agents} />
            <Stat label="Deals" value={summary.deals} />
            <Stat label="Lead spend" value={summary.leadSpend} />
            <Stat label="Accepted" value={summary.accepted} />
            <Stat label="Rejected" value={summary.rejected} tone={summary.rejected > 0 ? "warn" : undefined} />
          </div>
          {summary.missingAgentReferences.length > 0 && (
            <p className="mt-3 text-[11px] text-health-yellow">
              Deals/lead-spend reference agents not in this import:{" "}
              <span className="tnum">{summary.missingAgentReferences.join(", ")}</span>. They will attach if those
              agents already exist, otherwise they import unattached.
            </p>
          )}
        </div>
      )}

      {result && result.rejected.length > 0 && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted">Rejected rows</div>
          <ul className="mt-2 space-y-1 text-[12px] text-muted">
            {result.rejected.slice(0, 12).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"tnum text-xl " + (tone === "warn" ? "text-health-yellow" : "text-ink-text")}>{value}</div>
    </div>
  );
}
