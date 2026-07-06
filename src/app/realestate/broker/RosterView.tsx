import type { RosterData } from "@/lib/realestate/load-roster";
import { SPEED_TO_LEAD_TARGET_SEC } from "@/lib/realestate/lead-metrics";

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// Color a response time against the SLA: green within target, amber up to 15m, red beyond.
function bandClass(sec: number | null): string {
  if (sec == null) return "text-neutral-400";
  if (sec <= SPEED_TO_LEAD_TARGET_SEC) return "text-emerald-600 dark:text-emerald-400";
  if (sec <= 15 * 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-neutral-500">{hint}</div> : null}
    </div>
  );
}

export function RosterView({ brokerageName, data }: { brokerageName: string; data: RosterData }) {
  const { rows, overall, totalLeads } = data;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500">{brokerageName}</div>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Speed-to-Lead Roster</h1>
        <p className="mt-1 text-sm text-neutral-500">
          First response measured from lead arrival. Target: under {Math.round(SPEED_TO_LEAD_TARGET_SEC / 60)} minutes.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Median response" value={fmtDuration(overall.medianResponseSec)} hint="across touched leads" />
        <Stat
          label="Within SLA"
          value={overall.pctWithinTarget == null ? "—" : `${overall.pctWithinTarget}%`}
          hint={`under ${Math.round(SPEED_TO_LEAD_TARGET_SEC / 60)} min`}
        />
        <Stat label="Leads" value={String(totalLeads)} hint={`${overall.untouched} untouched`} />
        <Stat label="Leaked to broker" value={String(overall.escalatedToBroker)} hint="past 30 min, no touch" />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium text-right">Leads</th>
              <th className="px-4 py-3 font-medium text-right">Median</th>
              <th className="px-4 py-3 font-medium text-right">Within SLA</th>
              <th className="px-4 py-3 font-medium text-right">Backup</th>
              <th className="px-4 py-3 font-medium text-right">Broker</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.agentId ?? "unassigned"}
                className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0"
              >
                <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100">
                  {r.agentName ?? (r.agentId == null ? "Unassigned" : "Agent")}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {r.stats.total}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${bandClass(r.stats.medianResponseSec)}`}>
                  {fmtDuration(r.stats.medianResponseSec)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                  {r.stats.pctWithinTarget == null ? "—" : `${r.stats.pctWithinTarget}%`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                  {r.stats.escalatedToBackup || ""}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                  {r.stats.escalatedToBroker || ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No leads yet. Seed the pilot tenant or connect the BoldTrail webhook.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Sorted worst-first (most leaked to broker, then slowest median). Numbers are computed by the deterministic engine.
      </p>
    </div>
  );
}
