"use client";

import { useState } from "react";
import type { BusinessType } from "@prisma/client";
import { csvToBrokerageRows, type BrokerageCsvProfile, type BrokerageEntity } from "@/lib/brokerage/csv-import";

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
type ImportBusiness = { id: string; name: string; businessType: BusinessType };

export function BrokerageImportPilot({ businesses = [] }: { businesses?: ImportBusiness[] }) {
  const brokerageBusinesses = businesses.filter((business) => business.businessType === "REAL_ESTATE_BROKERAGE");
  const importBusinesses = brokerageBusinesses.length > 0 ? brokerageBusinesses : businesses;
  const [text, setText] = useState(SAMPLE);
  const [restaurantId, setRestaurantId] = useState(importBusinesses[0]?.id ?? "");
  const [busy, setBusy] = useState<null | "preview" | "commit">(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [committed, setCommitted] = useState<CommitResponse | null>(null);
  const [csvEntity, setCsvEntity] = useState<BrokerageEntity>("deals");
  const [csvProfile, setCsvProfile] = useState<BrokerageCsvProfile>("generic");
  const [csvText, setCsvText] = useState("");
  const [csvNote, setCsvNote] = useState<string | null>(null);

  // Convert a pasted CSV (one entity at a time) into rows and merge them into
  // the JSON payload below, so an operator can build the import from spreadsheet
  // exports without hand-writing JSON.
  function convertCsv() {
    setCsvNote(null);
    setError(null);
    if (!csvText.trim()) return;
    const { rows, mapped, unmappedHeaders } = csvToBrokerageRows(csvEntity, csvText, csvProfile);
    if (rows.length === 0) {
      setError("No rows parsed from that CSV — check the header row.");
      return;
    }
    let base: Record<string, unknown> = {};
    try {
      const current = JSON.parse(text);
      if (current && typeof current === "object" && !Array.isArray(current)) base = current as Record<string, unknown>;
    } catch {
      // current box wasn't valid JSON; start fresh from the converted entity.
    }
    base[csvEntity] = rows;
    setText(JSON.stringify(base, null, 2));
    const mappedFields = Object.keys(mapped);
    setCsvNote(
      `Converted ${rows.length} ${csvEntity} row${rows.length === 1 ? "" : "s"} → mapped ${mappedFields.length} column${
        mappedFields.length === 1 ? "" : "s"
      } using ${PROFILE_LABELS[csvProfile]}${unmappedHeaders.length ? `; ignored: ${unmappedHeaders.join(", ")}` : ""}. Review the JSON, then Preview.`,
    );
    setCsvText("");
  }

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
        body: JSON.stringify({ restaurantId: restaurantId || undefined, payload }),
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
      {importBusinesses.length > 1 ? (
        <div className="rounded-lg border border-line bg-surface px-4 py-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted">Import into</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft"
            >
              {importBusinesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-[11px] text-muted">
            Consultants and accountants can import for any brokerage they have access to.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-muted">Have a spreadsheet? Convert CSV → JSON</div>
        <p className="mt-1 text-[11px] text-muted">
          Paste one export at a time. Choose the export style if you know it; Generic is fine for normal headers.
          Unrecognized columns are ignored.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={csvProfile}
            onChange={(e) => setCsvProfile(e.target.value as BrokerageCsvProfile)}
            className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            <option value="generic">Generic spreadsheet</option>
            <option value="lone_wolf">Lone Wolf-style export</option>
            <option value="skyslope">SkySlope-style export</option>
            <option value="loft47">Loft47-style export</option>
          </select>
          <select
            value={csvEntity}
            onChange={(e) => setCsvEntity(e.target.value as BrokerageEntity)}
            className="rounded-lg border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft"
          >
            <option value="agents">Agents</option>
            <option value="deals">Deals</option>
            <option value="leadSpend">Lead spend</option>
          </select>
          <button
            onClick={convertCsv}
            disabled={!csvText.trim()}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink-text hover:border-copper-dim disabled:opacity-50"
          >
            Convert into JSON
          </button>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          spellCheck={false}
          rows={5}
          placeholder={"Deal ID,Agent,Property Address,GCI,Agent Split %,Closed Date\nD1,A-1,412 Oak St,8750,70,2026-05-20"}
          className="tnum mt-2 w-full rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-[12px] text-ink-text placeholder:text-muted/40 outline-none focus:border-copper-soft"
        />
        {csvNote && <p className="mt-2 text-[11px] text-health-green">{csvNote}</p>}
      </div>

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

const PROFILE_LABELS: Record<BrokerageCsvProfile, string> = {
  generic: "Generic spreadsheet",
  lone_wolf: "Lone Wolf-style export",
  skyslope: "SkySlope-style export",
  loft47: "Loft47-style export",
};
