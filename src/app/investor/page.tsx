import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, Banknote, CircleDollarSign, Gauge, ShieldCheck, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadDashboardData, type DashboardData } from "@/lib/dashboard/data";
import { money, pct } from "@/lib/format";

type Tone = "green" | "yellow" | "red" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  green: "border-emerald-500/40 bg-emerald-500/8 text-emerald-200",
  yellow: "border-amber-500/45 bg-amber-500/10 text-amber-200",
  red: "border-orange-500/45 bg-orange-500/10 text-orange-200",
  muted: "border-white/10 bg-white/[0.03] text-slate-300",
};

function cashTone(data: DashboardData): Tone {
  if (!data.goLiveCoach.cashSafety.hasAnchor) return "yellow";
  return data.goLiveCoach.cashSafety.ready ? "green" : "red";
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
  const sourceRead = data.sourceSetup.requiredCount
    ? `${data.sourceSetup.connectedCount} of ${data.sourceSetup.requiredCount} required sources connected`
    : "No required source map set";

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
            data.goLiveCoach.cashSafety.hasAnchor
              ? money(data.goLiveCoach.cashSafety.minimumOperatingCash ?? 0)
              : "Anchor needed"
          }
          detail={
            data.goLiveCoach.cashSafety.hasAnchor
              ? data.goLiveCoach.cashSafety.ready
                ? "Cash can cover the operating floor after the modeled pilot set-aside."
                : `${money(Math.abs(data.goLiveCoach.cashSafety.cushionAfterPilot ?? 0))} below the modeled cash floor.`
              : "Operator needs to set the minimum cash anchor before runway can be trusted."
          }
          tone={cashTone(data)}
        />
        <MatrixCard
          icon={<CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
          label="Profit discipline"
          value={pct(data.goLiveCoach.categorizationCoveragePct, 0)}
          detail={
            taxReserve
              ? `${money(Math.abs(taxReserve.gap))} current tax reserve ${
                  taxReserve.gap >= 0 ? "cushion" : "shortfall"
                } flagged by the model.`
              : "Tax reserve is waiting for synced collected sales tax."
          }
          tone={data.goLiveCoach.categorizationCoveragePct >= 90 ? "green" : "yellow"}
        />
        <MatrixCard
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          label="Operating pressure"
          value={pct(data.heartbeat.primeCostPct, 1)}
          detail="Prime cost is the combined food, beverage, and labor pressure against sales."
          tone={primeCostTone}
        />
        <MatrixCard
          icon={<Activity className="h-4 w-4" aria-hidden="true" />}
          label="Investor return signal"
          value={data.realRevenue > 0 ? money(data.realRevenue) : "Waiting"}
          detail="Read-only signal for whether the business is producing usable revenue after first costs."
          tone={realRevenueTone}
        />
        <MatrixCard
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          label="Source freshness"
          value={sourceRead}
          detail={
            data.sourceSetup.missingRequired.length
              ? `Missing: ${data.sourceSetup.missingRequired.slice(0, 3).join(", ")}${
                  data.sourceSetup.missingRequired.length > 3 ? "..." : ""
                }`
              : "Minimum source map is connected."
          }
          tone={sourceTone(data)}
        />
      </div>
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
