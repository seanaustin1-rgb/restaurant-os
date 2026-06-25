import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
import type { GoLiveBucket, GoLiveCoachData, PilotMode } from "@/lib/modules/go-live-coach";
import { money, pct } from "@/lib/format";
import { GoLiveAssumptionsForm } from "./GoLiveAssumptionsForm";

const SIGNAL_TEXT: Record<GoLiveBucket["signal"], string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const SIGNAL_BORDER: Record<GoLiveBucket["signal"], string> = {
  green: "border-health-green/30 bg-health-green/5",
  yellow: "border-health-yellow/30 bg-health-yellow/5",
  red: "border-health-red/40 bg-health-red/5",
};

export function GoLiveCoachModule({ data }: { data: GoLiveCoachData }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-surface px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">Current stage</p>
            <h2 className="mt-1 font-display text-3xl text-copper-soft">{data.stageLabel}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{data.stageNote}</p>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#CFD2CC]">
              Go-Live Coach is not a generic business coach. It is a virtual readiness check for Profit First money
              movement: it replays what would have been set aside, compares that to cash safety and bucket pressure,
              then recommends whether to observe, keep coaching, rehearse a pilot, or go live.
            </p>
          </div>
          <div className="rounded-lg border border-copper-dim/40 bg-copper-dim/10 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-wider text-muted">Net sales read</p>
            <p className="tnum text-2xl text-[#E6E8E4]">{money(data.netSales)}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {data.salesDays} sales day{data.salesDays === 1 ? "" : "s"} - {data.periodLabel}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-ink/40 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted">Recommendation</p>
          <p className="mt-1 text-sm text-[#E6E8E4]">{data.recommendation}</p>
          <p className="mt-1 text-xs text-muted">{data.summary}</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-4">
          <StageExplainer label="Observe" text="Collect enough clean sales, cash, and spend data to trust the heartbeat." active={data.stage === "observe"} />
          <StageExplainer label="Coach" text="Find the bucket, category, tax, or cash issue that would break if transfers started today." active={data.stage === "coach" || data.stage === "simulate"} />
          <StageExplainer label="Pilot" text="Run a narrow real-world rehearsal after the virtual model shows enough cushion." active={data.stage === "pilot_ready"} />
          <StageExplainer label="Go live" text="Turn on the operating rhythm once cash safety, categorization, and bucket pressure are stable." active={data.stage === "enforce_ready"} />
        </div>
      </section>

      <GoLiveAssumptionsForm assumptions={data.assumptions} />

      <section>
        <h2 className="mb-2 font-display text-lg text-[#E6E8E4]">Readiness checks</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.checks.map((check) => (
            <div key={check.key} className="rounded-lg border border-line bg-surface px-3 py-3">
              <div className="flex items-center gap-1.5">
                {check.ready ? (
                  <CheckCircle2 size={14} className="text-health-green" />
                ) : (
                  <CircleDashed size={14} className="text-health-yellow" />
                )}
                <span className="text-xs text-[#E6E8E4]">{check.label}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface px-4 py-3 lg:col-span-1">
          <h2 className="font-display text-lg text-[#E6E8E4]">Cash floor</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{data.cashSafety.detail}</p>
          <div className="mt-3 space-y-2 text-[11px] text-muted">
            <div className="flex justify-between gap-3">
              <span>Estimated cash</span>
              <span className="tnum text-[#E6E8E4]">
                {data.cashSafety.currentCash != null ? money(data.cashSafety.currentCash) : "Needs anchor"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Operating floor</span>
              <span className="tnum text-[#E6E8E4]">
                {data.cashSafety.minimumOperatingCash != null ? money(data.cashSafety.minimumOperatingCash) : "Unknown"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Virtual pilot set-aside</span>
              <span className="tnum text-[#E6E8E4]">{money(data.cashSafety.pilotSetAside)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Remaining cushion</span>
              <span className={"tnum " + (data.cashSafety.ready ? "text-health-green" : "text-health-red")}>
                {data.cashSafety.cushionAfterPilot != null ? money(data.cashSafety.cushionAfterPilot) : "Unknown"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-surface px-4 py-3 lg:col-span-2">
          <h2 className="font-display text-lg text-[#E6E8E4]">Operator decisions</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {data.decisions.map((decision) => (
              <div key={decision.key} className="rounded-md border border-line bg-ink/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#E6E8E4]">{decision.label}</span>
                  <span className={"text-[10px] uppercase tracking-wider " + verdictClass(decision.verdict)}>
                    {decision.verdict}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{decision.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {data.shortfalls.length > 0 && (
        <section className="rounded-lg border border-health-red/40 bg-health-red/5 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-health-red" />
            <div>
              <h2 className="text-sm text-health-red">Where the model breaks first</h2>
              <p className="mt-1 text-xs text-muted">
                These buckets would not have had enough money if real transfers were enforced today.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.shortfalls.map((b) => (
                  <div key={b.key} className="rounded-md border border-health-red/30 bg-ink/40 px-3 py-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-[#E6E8E4]">{b.label}</span>
                      <span className="tnum text-sm text-health-red">{money(Math.abs(b.gap))} short</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{b.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-lg text-[#E6E8E4]">Virtual pilot path</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {data.pilotPlan.map((step) => (
            <div key={step.key} className="rounded-lg border border-line bg-surface px-3 py-3">
              <div className="text-xs text-[#E6E8E4]">{step.label}</div>
              <div className={"mt-1 text-[10px] uppercase tracking-wider " + pilotModeClass(step.mode)}>
                {pilotModeLabel(step.mode)}
              </div>
              {step.amount != null && step.amount > 0 && (
                <div className="tnum mt-1 text-sm text-[#E6E8E4]">{money(step.amount)}</div>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-lg text-[#E6E8E4]">Virtual bucket pressure</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.buckets.map((bucket) => (
            <BucketCard key={bucket.key} bucket={bucket} />
          ))}
        </div>
      </section>

      <p className="rounded-lg border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
        Virtual-only: this coach does not move money. It replays what Profit First would have done, compares that
        against actual cleared activity, and recommends when the operator can safely start a narrow pilot.
      </p>
    </div>
  );
}

function pilotModeLabel(mode: PilotMode): string {
  if (mode === "pilot_candidate") return "pilot candidate";
  if (mode === "not_ready") return "not ready";
  return "virtual";
}

function pilotModeClass(mode: PilotMode): string {
  if (mode === "pilot_candidate") return "text-health-green";
  if (mode === "not_ready") return "text-health-red";
  return "text-muted";
}

function verdictClass(verdict: "go" | "wait" | "watch"): string {
  if (verdict === "go") return "text-health-green";
  if (verdict === "wait") return "text-health-red";
  return "text-health-yellow";
}

function StageExplainer({ label, text, active }: { label: string; text: string; active: boolean }) {
  return (
    <div className={"rounded-md border px-3 py-2 " + (active ? "border-copper-dim bg-copper/10" : "border-line bg-surface/60")}>
      <div className={active ? "text-copper-soft" : "text-[#E6E8E4]"}>{label}</div>
      <p className="mt-1 leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function BucketCard({ bucket }: { bucket: GoLiveBucket }) {
  const over = bucket.gap < 0;
  return (
    <div className={clsx("rounded-lg border px-4 py-3", SIGNAL_BORDER[bucket.signal])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            {bucket.ready ? (
              <ShieldCheck size={14} className="text-health-green" />
            ) : (
              <AlertTriangle size={14} className={SIGNAL_TEXT[bucket.signal]} />
            )}
            <h3 className="text-sm text-[#E6E8E4]">{bucket.label}</h3>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{bucket.note}</p>
        </div>
        <span className={clsx("text-[11px] uppercase tracking-wider", SIGNAL_TEXT[bucket.signal])}>
          {bucket.signal}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted">
        <div>
          <div>Should hold</div>
          <div className="tnum text-sm text-[#E6E8E4]">{money(bucket.target)}</div>
        </div>
        <div>
          <div>{bucket.kind === "accrue" ? "Cleared" : "Used"}</div>
          <div className="tnum text-sm text-[#E6E8E4]">{money(bucket.actual)}</div>
        </div>
        <div>
          <div>{over ? "Short" : "Room"}</div>
          <div className={clsx("tnum text-sm", over ? "text-health-red" : "text-health-green")}>
            {money(Math.abs(bucket.gap))}
          </div>
        </div>
      </div>

      {bucket.usagePct != null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>capacity used</span>
            <span className="tnum">{pct(bucket.usagePct, 0)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink">
            <div
              className={clsx(
                "h-full rounded-full",
                bucket.signal === "green" ? "bg-health-green" : bucket.signal === "yellow" ? "bg-health-yellow" : "bg-health-red",
              )}
              style={{ width: `${Math.min(bucket.usagePct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
