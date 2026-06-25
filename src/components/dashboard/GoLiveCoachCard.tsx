import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import type { GoLiveCoachData } from "@/lib/modules/go-live-coach";
import { money } from "@/lib/format";

export function GoLiveCoachCard({ data, demoMode = false }: { data: GoLiveCoachData; demoMode?: boolean }) {
  const Icon = data.stage === "pilot_ready" || data.stage === "enforce_ready" ? CheckCircle2 : data.stage === "coach" ? AlertTriangle : CircleDashed;
  const color =
    data.stage === "pilot_ready" || data.stage === "enforce_ready"
      ? "text-health-green"
      : data.stage === "coach"
        ? "text-health-yellow"
        : "text-muted";

  return (
    <section className="rounded-lg border border-copper-dim/40 bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Icon size={18} className={"mt-0.5 shrink-0 " + color} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-display text-lg text-[#E6E8E4]">Go-Live Coach</h2>
              <span className={"text-xs uppercase tracking-wider " + color}>{data.stageLabel}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Readiness coach for Profit First automation. It runs the money-movement plan virtually first, then tells
              you what must be fixed before real transfers should begin.
            </p>
            <p className="mt-1 text-sm text-[#E6E8E4]">{data.recommendation}</p>
            <p className="mt-1 text-xs text-muted">{data.summary}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted">virtual sales read</p>
          <p className="tnum text-xl text-[#E6E8E4]">{money(data.netSales)}</p>
          {!demoMode && (
            <Link href="/modules/go-live" className="mt-1 inline-block text-xs text-copper-soft underline-offset-2 hover:underline">
              open readiness plan
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
