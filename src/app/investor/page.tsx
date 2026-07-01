import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Banknote, CircleDollarSign, Gauge, Star, TrendingUp, WalletCards } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard/data";
import { deriveSourceTrust } from "@/lib/dashboard/signals";
import { money, pct } from "@/lib/format";

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
  const trust = deriveSourceTrust(data);
  if (trust.required === 0) return "muted";
  if (trust.status === "healthy") return "green";
  if (data.sourceSetup.connectedCount > 0) return "yellow";
  return "red";
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

  const dailyBurn = cash.avgDailyFixedBurn != null ? `${money(cash.avgDailyFixedBurn)} estimated daily fixed burn` : "fixed burn still unknown";
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
  const sourceTrust = deriveSourceTrust(data);
  const sourceRead = sourceTrust.required
    ? `${data.sourceSetup.connectedCount} of ${data.sourceSetup.requiredCount} required sources connected`
    : "No required source map set";
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
              ? "Collected sales tax isn't synced yet; the reserve can only stay virtual."
              : `${money(Math.abs(taxReserve.gap))} ${
                  taxReserve.gap >= 0 ? "cushion over" : "shortfall against"
                } the collected-tax reserve.`
          }
          tone={!taxReserve || taxReserve.signal === "yellow" ? "yellow" : (taxReserve.signal as Tone)}
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
          value={aura.hasAnyData && aura.overallRating != null ? `${aura.overallRating.toFixed(1)} stars` : "No data"}
          detail={
            aura.hasAnyData
              ? `${aura.totalReviews.toLocaleString()} reviews across connected reputation sources.`
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
      <p className={`mt-4 rounded-lg border px-3 py-2 text-xs leading-5 ${TONE_CLASS[sourceTone(data)]}`}>
        Source trust: {sourceRead}
        {data.sourceSetup.missingRequired.length
          ? `; missing ${data.sourceSetup.missingRequired.slice(0, 3).join(", ")}${
              data.sourceSetup.missingRequired.length > 3 ? "..." : ""
            }.`
          : "."}
      </p>
    </article>
  );
}

export default async function InvestorPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId, role: "INVESTOR" },
    select: {
      restaurantId: true,
      createdAt: true,
      restaurant: {
        select: {
          _count: {
            select: {
              dailySales: true,
              transactions: true,
              posConnections: true,
              plaidConnections: true,
            },
          },
        },
      },
    },
    distinct: ["restaurantId"],
  });

  roles.sort((a, b) => {
    const aCount = a.restaurant._count;
    const bCount = b.restaurant._count;
    const aScore = aCount.dailySales * 4 + aCount.transactions + aCount.posConnections * 10 + aCount.plaidConnections * 10;
    const bScore = bCount.dailySales * 4 + bCount.transactions + bCount.posConnections * 10 + bCount.plaidConnections * 10;
    if (bScore !== aScore) return bScore - aScore;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const dashboards: DashboardData[] = [];
  for (const role of roles) {
    dashboards.push(await loadDashboardData(role.restaurantId));
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Read-only access</div>
        <h1 className="mt-2 text-3xl font-semibold text-white">Investor Matrix</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          A focused view of financial safety, operating pressure, and source readiness for businesses shared with you.
        </p>
      </div>

      {dashboards.length === 0 ? (
        <section className="rounded-lg border border-white/10 bg-[#111511] p-6">
          <h2 className="text-xl font-semibold text-white">No investor access yet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Ask the operator, consultant, or accountant to invite your email as an investor.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {dashboards.map((dashboard) => (
            <InvestorMatrix key={dashboard.restaurantId} data={dashboard} />
          ))}
        </div>
      )}
    </main>
  );
}
