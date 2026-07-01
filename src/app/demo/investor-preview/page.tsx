/**
 * TEMPORARY dev-only, NO-AUTH preview of the Investor Matrix, rendered off the
 * demo DB so it can be eyeballed without fighting Clerk's dev-instance sign-in.
 *
 * - Lives under /demo/* which is a PUBLIC route in middleware (no auth).
 * - 404s in production (NODE_ENV guard) — defense in depth; do not ship.
 * - Uses the MAIN prisma client + loadDashboardData (same as /investor), so it
 *   also proves whether this server is actually pointed at the demo DB.
 *
 * DELETE this file once the investor view has been confirmed.
 */
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Banknote, CircleDollarSign, Gauge, Star, TrendingUp, WalletCards } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard/data";
import { money, pct } from "@/lib/format";
import { AttentionAndNotes, type UserNote } from "./AttentionAndNotes";
import { deriveAttention, deriveTopPressure, deriveSourceTrust } from "@/lib/dashboard/signals";

export const dynamic = "force-dynamic";

type Tone = "green" | "yellow" | "red" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  green: "border-emerald-500/40 bg-emerald-500/8 text-emerald-200",
  yellow: "border-amber-500/45 bg-amber-500/10 text-amber-200",
  red: "border-orange-500/45 bg-orange-500/10 text-orange-200",
  muted: "border-white/10 bg-white/[0.03] text-slate-300",
};

function cashTone(data: DashboardData): Tone {
  if (data.cashSafety.status === "unknown") return "yellow";
  return data.cashSafety.status;
}

function operatingProfitTone(data: DashboardData): Tone {
  const margin = data.operatingProfit.marginPct;
  if (margin == null) return "muted";
  if (margin >= 10) return "green";
  if (margin >= 3) return "yellow";
  return "red";
}

function cashDetail(data: DashboardData): string {
  const cash = data.cashSafety;
  if (cash.currentCash == null) {
    return "Operator needs to set one starting cash balance/date before runway can be trusted.";
  }

  const dailyBurn =
    cash.avgDailyFixedBurn != null
      ? `${money(cash.avgDailyFixedBurn)} estimated daily fixed burn`
      : "fixed burn still unknown";
  const delta =
    cash.netCashChangePeriod == null
      ? "no bank movement in this period yet"
      : `${cash.netCashChangePeriod >= 0 ? "+" : ""}${money(cash.netCashChangePeriod)} net cash movement this period`;
  const review =
    cash.pendingReviewCount > 0
      ? ` ${cash.pendingReviewCount} fixed-cost event${cash.pendingReviewCount === 1 ? "" : "s"} still need review.`
      : "";

  return `${dailyBurn}; ${delta}.${review}`;
}

function readinessPct(data: DashboardData): number {
  const checks = data.goLiveCoach.checks;
  if (checks.length === 0) return 0;
  return (checks.filter((check) => check.ready).length / checks.length) * 100;
}

function readinessTone(data: DashboardData): Tone {
  const readiness = readinessPct(data);
  if (readiness >= 85) return "green";
  if (readiness >= 60) return "yellow";
  return "red";
}

function sourceTone(data: DashboardData): Tone {
  if (data.sourceSetup.requiredCount === 0) return "muted";
  if (data.sourceSetup.connectedCount >= data.sourceSetup.requiredCount) return "green";
  if (data.sourceSetup.connectedCount > 0) return "yellow";
  return "red";
}

function MatrixCard({
  icon,
  label,
  value,
  detail,
  tone = "muted",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}) {
  return (
    <section className={`rounded-lg border p-4 ${TONE_CLASS[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </section>
  );
}

function InvestorMatrix({ data }: { data: DashboardData }) {
  const primeCostTone: Tone =
    data.heartbeat.primeCostPct <= 60 ? "green" : data.heartbeat.primeCostPct <= 68 ? "yellow" : "red";
  const realRevenueTone: Tone = data.realRevenue > 0 ? "green" : data.revenue.revenueMTD > 0 ? "yellow" : "red";
  const readiness = readinessPct(data);
  const taxReserve = data.goLiveCoach.buckets.find((bucket) => bucket.key === "tax-reserve");
  const aura = data.aura;
  const operating = data.operatingProfit;

  return (
    <article className="rounded-lg border border-white/10 bg-[#111511] p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Investor matrix</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{data.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{data.periodLabel}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASS[readinessTone(data)]}`}>
          {pct(readiness, 0)} go-live readiness
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MatrixCard
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          label="Revenue read"
          value={money(data.revenue.revenueMTD)}
          detail={`${money(data.realRevenue)} real revenue after tracked cost pressure.`}
          tone={realRevenueTone}
        />
        <MatrixCard
          icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
          label="Cash oxygen"
          value={
            data.cashSafety.oxygenDays != null
              ? `${Math.floor(data.cashSafety.oxygenDays)} days`
              : data.cashSafety.currentCash != null
                ? money(data.cashSafety.currentCash)
                : "Anchor needed"
          }
          detail={cashDetail(data)}
          tone={cashTone(data)}
        />
        <MatrixCard
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
          label="Tax & reserve discipline"
          value={
            !taxReserve || taxReserve.signal === "yellow"
              ? "Unverified"
              : taxReserve.signal === "red"
                ? "Short"
                : "On track"
          }
          detail={
            !taxReserve || taxReserve.signal === "yellow"
              ? "Collected sales tax isn't synced yet — the reserve can only stay virtual."
              : `${money(Math.abs(taxReserve.gap))} ${
                  taxReserve.gap >= 0 ? "cushion over" : "shortfall against"
                } the collected-tax reserve.`
          }
          tone={!taxReserve ? "yellow" : (taxReserve.signal as Tone)}
        />
        <MatrixCard
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          label="Operating pressure"
          value={pct(data.heartbeat.primeCostPct, 1)}
          detail="Prime cost is the combined food, beverage, and labor pressure against sales."
          tone={primeCostTone}
        />
        <MatrixCard
          icon={<WalletCards className="h-4 w-4" aria-hidden="true" />}
          label="Operating margin"
          value={operating.marginPct == null ? "Waiting" : pct(operating.marginPct, 1)}
          detail={`${money(operating.amount)} distributable profit pool before ${operating.excludes.slice(0, 3).join(", ")} and other excluded items.`}
          tone={operatingProfitTone(data)}
        />
        <MatrixCard
          icon={<Star className="h-4 w-4" aria-hidden="true" />}
          label="Reputation"
          value={aura.hasAnyData && aura.overallRating != null ? `${aura.overallRating.toFixed(1)}★` : "No data"}
          detail={
            aura.hasAnyData
              ? `${aura.totalReviews.toLocaleString()} reviews across connected sources (Google / Yelp).`
              : "Connect Google or Yelp to surface the reputation read."
          }
          tone={
            !aura.hasAnyData || aura.overallRating == null
              ? "muted"
              : aura.overallRating >= 4.2
                ? "green"
                : aura.overallRating >= 3.7
                  ? "yellow"
                  : "red"
          }
        />
      </div>
    </article>
  );
}

export default async function InvestorPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const restaurant = await prisma.restaurant.findFirst({
    where: { slug: "demo-bistro" },
    select: { id: true },
  });

  const data = restaurant ? await loadDashboardData(restaurant.id) : null;
  const attention = data ? deriveAttention(data) : [];
  const topPressure = data ? deriveTopPressure(data) : null;
  const sourceTrust = data ? deriveSourceTrust(data) : null;

  // One seeded note so the "managed event" state is visible. The real version
  // persists these per-metric (MetricNote model + server action).
  const sampleNotes: Record<string, UserNote> = {
    "gauge-opex": {
      date: "2026-06-12",
      text: "Unexpected HVAC compressor replacement ($1,200) landed in OpEx this month — one-time capital repair, not recurring. Warranty claim filed.",
    },
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <strong>DEV PREVIEW — no auth.</strong> Investor Mode (notes-bridged): the Attention zone surfaces over-target
        items, and a dated note turns a red alert into a managed event. Notes are prototype client-state only. 404s in
        production. Delete after review.
      </div>

      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Read-only access</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Investor Matrix</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          A focused view of financial safety, operating pressure, and source readiness for businesses shared with you.
        </p>
      </div>

      {!data ? (
        <section className="rounded-lg border border-orange-500/45 bg-orange-500/10 p-6">
          <h2 className="text-xl font-semibold text-white">Demo Bistro not found on this DB</h2>
          <p className="mt-2 text-sm leading-6 text-orange-200">
            The main Prisma client did not find slug <code>demo-bistro</code> — this server is NOT pointed at the demo
            database (it&apos;s reading prod/another DB). That means the env override didn&apos;t take.
          </p>
        </section>
      ) : (
        <>
          {topPressure?.state === "pressure" && (
            <div className="mb-4 rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">The one thing</div>
              <p className="mt-1 text-sm text-orange-100">
                <span className="font-semibold text-white">{topPressure.label}</span> — {topPressure.readout}
              </p>
            </div>
          )}
          {topPressure?.state === "insufficient-data" && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
              Not enough history to call the top pressure point yet. {topPressure.reason}
            </div>
          )}

          <AttentionAndNotes items={attention} initialNotes={sampleNotes} />
          <InvestorMatrix data={data} />

          {sourceTrust &&
            (sourceTrust.escalate ? (
              <div className="mt-4 rounded-lg border border-orange-500/45 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
                <strong>Source coverage incomplete.</strong> {sourceTrust.connected}/{sourceTrust.required} required
                sources connected
                {sourceTrust.missing.length ? ` — missing ${sourceTrust.missing.slice(0, 3).join(", ")}` : ""}. Figures
                above may be partial until connected.
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">
                Data sources: {sourceTrust.connected}/{sourceTrust.required} required connected · {sourceTrust.status}.
              </p>
            ))}
        </>
      )}
    </main>
  );
}
