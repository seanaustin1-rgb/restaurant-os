"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Database, FileJson, RefreshCw, Upload } from "lucide-react";

type SourceKind = "ESCAPIA" | "PMS" | "CSV" | "QUICKBOOKS" | "REVIEWS" | "MAINTENANCE" | "OTHER";
type Status = "idle" | "previewing" | "previewed" | "importing" | "done" | "error";

interface ImportSummary {
  properties: number;
  bookings: number;
  ownerStatements: number;
  expenses: number;
  maintenanceIssues: number;
  reviews: number;
  accepted: number;
  rejected: number;
  missingUnitReferences: string[];
}

interface PreviewResponse {
  summary: ImportSummary;
  rejected: string[];
  preview: Record<string, unknown[]>;
}

type ImportBusiness = { id: string; name: string };

const SAMPLE_PAYLOAD = {
  properties: [
    {
      externalUnitId: "unit_101",
      name: "Lake House",
      city: "York",
      state: "PA",
      bedrooms: 4,
      bathrooms: 2.5,
      sleeps: 10,
    },
    {
      externalUnitId: "unit_202",
      name: "Downtown Condo",
      city: "York",
      state: "PA",
      bedrooms: 2,
      bathrooms: 2,
      sleeps: 4,
    },
  ],
  bookings: [
    {
      externalBookingId: "booking_500",
      externalUnitId: "unit_101",
      channel: "Airbnb",
      checkIn: "2026-07-01",
      checkOut: "2026-07-05",
      grossRent: 2400,
      fees: 180,
      taxes: 144,
      platformFees: 72,
    },
    {
      externalBookingId: "booking_501",
      externalUnitId: "unit_202",
      channel: "Direct",
      checkIn: "2026-07-10",
      checkOut: "2026-07-12",
      grossRent: 780,
      fees: 90,
      taxes: 52,
      platformFees: 0,
    },
  ],
  ownerStatements: [
    {
      externalUnitId: "unit_101",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      grossRevenue: 12000,
      ownerPayout: 7600,
      managementFees: 2160,
      expenses: 900,
    },
  ],
  expenses: [
    {
      externalUnitId: "unit_202",
      kind: "MAINTENANCE",
      vendor: "HVAC Co",
      description: "Mini-split service",
      date: "2026-07-11",
      amount: 425,
    },
  ],
  maintenanceIssues: [
    {
      externalUnitId: "unit_202",
      title: "HVAC noise",
      openedAt: "2026-07-11T12:00:00.000Z",
      estimatedCost: 425,
      isRepeatIssue: true,
    },
  ],
  reviews: [
    {
      externalUnitId: "unit_101",
      platform: "Google",
      rating: 4.8,
      reviewedAt: "2026-07-08",
      responseHours: 3,
    },
  ],
};

const SUMMARY_FIELDS: Array<[keyof ImportSummary, string]> = [
  ["properties", "Properties"],
  ["bookings", "Bookings"],
  ["ownerStatements", "Owner statements"],
  ["expenses", "Expenses"],
  ["maintenanceIssues", "Maintenance"],
  ["reviews", "Reviews"],
];

export function RentalImportPilot({ businesses = [] }: { businesses?: ImportBusiness[] }) {
  const [restaurantId, setRestaurantId] = useState(businesses[0]?.id ?? "");
  const [sourceName, setSourceName] = useState("Escapia");
  const [sourceKind, setSourceKind] = useState<SourceKind>("ESCAPIA");
  const [fileName, setFileName] = useState("");
  const [jsonText, setJsonText] = useState(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);

  const parsedPayload = useMemo(() => {
    try {
      return { ok: true as const, payload: JSON.parse(jsonText) as unknown };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Invalid JSON" };
    }
  }, [jsonText]);

  async function previewImport() {
    if (!parsedPayload.ok) {
      setError(`JSON needs attention: ${parsedPayload.error}`);
      setStatus("error");
      return;
    }
    setStatus("previewing");
    setError(null);
    setBatchId(null);
    try {
      const r = await fetch("/api/vacation-rentals/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: restaurantId || undefined, sourceName, sourceKind, payload: parsedPayload.payload }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Preview failed");
      setPreview(j);
      setStatus("previewed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      setStatus("error");
    }
  }

  async function commitImport() {
    if (!parsedPayload.ok || !preview) return;
    setStatus("importing");
    setError(null);
    try {
      const r = await fetch("/api/vacation-rentals/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurantId || undefined,
          sourceName,
          sourceKind,
          fileName: fileName.trim() || null,
          payload: parsedPayload.payload,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed");
      setPreview({ summary: j.summary, rejected: j.rejected ?? [], preview: preview.preview });
      setBatchId(j.batchId ?? null);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus("error");
    }
  }

  const canPreview = status !== "previewing" && status !== "importing";
  const canCommit = preview != null && preview.summary.accepted > 0 && status !== "importing" && status !== "previewing";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className="space-y-4 rounded-lg border border-line bg-surface p-4">
        {businesses.length === 0 && (
          <div className="rounded-lg border border-health-yellow/40 bg-health-yellow/10 px-3 py-2 text-sm leading-relaxed text-ink-text">
            No vacation-rental business is available for this import. Add or switch to a vacation-rental business before
            saving data.
          </div>
        )}

        {businesses.length > 1 && (
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Import into</span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft"
            >
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2 text-sm text-ink-text">
          <FileJson size={16} className="text-copper-soft" />
          Rental export payload
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Source name</span>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Source type</span>
            <select
              value={sourceKind}
              onChange={(e) => setSourceKind(e.target.value as SourceKind)}
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft"
            >
              <option value="ESCAPIA">Escapia</option>
              <option value="PMS">Other PMS</option>
              <option value="CSV">CSV</option>
              <option value="QUICKBOOKS">QuickBooks</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="REVIEWS">Reviews</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">File label</span>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="July export"
              className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-ink-text outline-none placeholder:text-muted/50 focus:border-copper-soft"
            />
          </label>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setPreview(null);
            setBatchId(null);
            setStatus("idle");
          }}
          spellCheck={false}
          className="min-h-[520px] w-full rounded-lg border border-line bg-ink p-3 font-mono text-xs leading-relaxed text-ink-text outline-none focus:border-copper-soft"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={previewImport}
            disabled={!canPreview}
            className="inline-flex items-center gap-2 rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
          >
            {status === "previewing" ? <RefreshCw size={15} className="animate-spin" /> : <Database size={15} />}
            {status === "previewing" ? "Previewing" : "Preview import"}
          </button>
          <button
            onClick={() => {
              setJsonText(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
              setPreview(null);
              setBatchId(null);
              setStatus("idle");
              setError(null);
            }}
            className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:border-copper-dim hover:text-ink-text"
          >
            Load sample
          </button>
        </div>

        {error && <p className="text-sm text-health-red">{error}</p>}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-ink-text">Import review</div>
            {status === "done" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-health-green/30 bg-health-green/10 px-2 py-0.5 text-[11px] text-health-green">
                <CheckCircle2 size={12} /> Saved
              </span>
            )}
          </div>

          {preview ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {SUMMARY_FIELDS.map(([key, label]) => (
                  <SummaryTile key={key} label={label} value={preview.summary[key]} />
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-line bg-ink/60 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <SummaryStat label="Accepted rows" value={preview.summary.accepted} tone="text-health-green" />
                  <SummaryStat label="Rejected rows" value={preview.summary.rejected} tone={preview.summary.rejected > 0 ? "text-health-red" : "text-muted"} />
                </div>
                {preview.summary.missingUnitReferences.length > 0 && (
                  <p className="mt-3 text-[11px] leading-relaxed text-health-yellow">
                    Missing unit references: {preview.summary.missingUnitReferences.join(", ")}
                  </p>
                )}
              </div>

              {preview.rejected.length > 0 && (
                <div className="mt-4 rounded-lg border border-health-red/30 bg-health-red/10 p-3">
                  <div className="text-[11px] uppercase tracking-wider text-health-red">Rows needing attention</div>
                  <ul className="mt-2 space-y-1 text-[11px] text-muted">
                    {preview.rejected.slice(0, 6).map((row, i) => (
                      <li key={`${row}-${i}`}>{row}</li>
                    ))}
                  </ul>
                </div>
              )}

              {status === "done" && batchId && (
                <p className="mt-4 rounded-lg border border-health-green/30 bg-health-green/10 px-3 py-2 text-sm text-health-green">
                  Import saved. Batch: <span className="tnum">{batchId}</span>
                </p>
              )}

              <button
                onClick={commitImport}
                disabled={!canCommit}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-copper px-4 py-2.5 text-sm font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
              >
                {status === "importing" ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />}
                {status === "importing" ? "Importing" : "Import reviewed rows"}
              </button>
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-line bg-ink/40 p-5 text-sm leading-relaxed text-muted">
              Preview an export to see recognized rows, missing unit references, and anything that needs attention before saving.
            </div>
          )}
        </section>

        {preview && (
          <section className="rounded-lg border border-line bg-surface p-4">
            <div className="text-sm text-ink-text">Sample recognized rows</div>
            <div className="mt-3 space-y-3">
              {Object.entries(preview.preview).map(([key, rows]) => (
                <div key={key} className="rounded-lg border border-line bg-ink/60 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-copper-soft">{labelForPreview(key)}</div>
                  <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                    {JSON.stringify(rows, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string[] }) {
  return (
    <div className="rounded-lg border border-line bg-ink/60 p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tnum mt-1 text-2xl text-ink-text">{Array.isArray(value) ? value.length : value}</div>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"tnum text-xl " + tone}>{value}</div>
    </div>
  );
}

function labelForPreview(key: string): string {
  if (key === "ownerStatements") return "Owner statements";
  if (key === "maintenanceIssues") return "Maintenance issues";
  return key;
}
