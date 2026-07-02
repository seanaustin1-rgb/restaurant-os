import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, BriefcaseBusiness, CircleDollarSign, Gauge, Target, Timer, TrendingUp, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { HealthSignal } from "@/components/health/HealthSignal";
import { money, pct } from "@/lib/format";
import { loadBrokerageAgentCockpitForUser, loadBrokerageCockpit } from "@/lib/modules/brokerage-analytics";
import type { HealthStatus } from "@/lib/profit-first/calculator";

// Agent-context health words (the icon stays fixed by status inside HealthSignal).
const AGENT_HEALTH_WORD: Record<HealthStatus, string> = { green: "Healthy", yellow: "Watch", red: "Pressure" };
const HEALTH_TEXT: Record<HealthStatus, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

function primaryEmail(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  return (
    user?.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null
  );
}

export default async function BrokerageAgentCockpitPage({
  searchParams,
}: {
  searchParams?: { restaurantId?: string; agentId?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = primaryEmail(user);
  const roles = await prisma.userRestaurantRole.findMany({
    where: {
      clerkUserId: userId,
      restaurant: { businessType: "REAL_ESTATE_BROKERAGE" },
    },
    select: { role: true, restaurantId: true },
    orderBy: { createdAt: "asc" },
  });

  const authorizedRestaurantIds = new Set(roles.map((role) => role.restaurantId));
  const requestedRestaurantId = searchParams?.restaurantId ?? null;
  const selectedRestaurantId =
    requestedRestaurantId && authorizedRestaurantIds.has(requestedRestaurantId)
      ? requestedRestaurantId
      : roles[0]?.restaurantId ?? null;
  const cockpit = selectedRestaurantId ? await loadBrokerageCockpit(selectedRestaurantId) : null;
  const selectedAgentId = searchParams?.agentId ?? cockpit?.agentProduction.allAgents[0]?.agentId ?? null;
  const data = await loadBrokerageAgentCockpitForUser({
    clerkUserId: userId,
    userEmail: email,
    restaurantId: selectedRestaurantId,
    agentId: selectedAgentId,
  });

  const canSelectAgents = roles.some((role) => ["OPERATOR", "MANAGER", "CONSULTANT"].includes(role.role));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/modules/brokerage" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-copper-soft">
            <ArrowLeft size={14} /> Brokerage analytics
          </Link>
          <h1 className="mt-2 font-display text-2xl text-copper-soft">Agent Cockpit</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
            Agent-facing production, projected income, and lead efficiency. Leadership can select agents; agent-scoped
            users only resolve their own email/source identity.
          </p>
        </div>
        <Link href="/import/brokerage" className="rounded-md border border-copper-dim px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
          Update brokerage data
        </Link>
      </div>

      {canSelectAgents && cockpit && cockpit.agentProduction.allAgents.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted">Select agent</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cockpit.agentProduction.allAgents.map((agent) => (
              <Link
                key={agent.agentId}
                href={`/modules/brokerage/agent-cockpit?restaurantId=${cockpit.restaurantId}&agentId=${agent.agentId}`}
                className={
                  "rounded-md border px-3 py-2 text-xs " +
                  (agent.agentId === data?.agent.agentId
                    ? "border-copper bg-copper/10 text-copper-soft"
                    : "border-line text-ink-text hover:border-copper-dim")
                }
              >
                {agent.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!data ? (
        <section className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          No agent cockpit is available yet. Import brokerage agents/deals, or make sure your login email matches an agent
          identity.
        </section>
      ) : (
        <AgentCockpit data={data} />
      )}
    </main>
  );
}

function AgentCockpit({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof loadBrokerageAgentCockpitForUser>>>;
}) {
  const agent = data.agent;
  const { production, forecast, leads } = data;
  const capProgress = production.capProgressPct != null ? `${Math.round(production.capProgressPct)}% of cap used` : "No cap tracked";
  const capRemaining = production.capRemaining != null ? money(production.capRemaining) : "No cap tracked";
  const goalCoverage = forecast.incomeGoalCoveragePct != null ? `${pct(forecast.incomeGoalCoveragePct, 0)} of goal` : "Add income goal";
  const leadRoi = leads.grossRoiMultiple != null ? `${leads.grossRoiMultiple.toFixed(1)}x` : "Needs attribution";
  const leadNetRoi = leads.netCommissionRoiMultiple != null ? `${leads.netCommissionRoiMultiple.toFixed(1)}x net` : "Net ROI pending";
  const appointmentConversion = leads.appointmentConversionPct != null ? pct(leads.appointmentConversionPct, 1) : "Needs BoldTrail activity";
  const closeConversion = leads.closeConversionPct != null ? pct(leads.closeConversionPct, 1) : "Needs closed-lead match";
  const focus = agentFocus(data);
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-copper-dim/40 bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {data.restaurantName} - {data.periodLabel}
            </p>
            <h2 className="mt-1 font-display text-3xl text-ink-text">{agent.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {agent.email ?? "No email matched"} -{" "}
              {agent.sourceConfidence === "imported"
                ? "imported data"
                : agent.sourceConfidence === "mixed"
                  ? "mixed imported and modeled data"
                  : "profile assumption"}
            </p>
          </div>
          <HealthSignal status={agent.health} mode="badge" label={AGENT_HEALTH_WORD[agent.health]} />
        </div>
      </section>

      {focus ? (
        <div className="rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-copper-soft">Focus this week</div>
          <p className="mt-1 text-sm leading-relaxed text-ink-text">{focus}</p>
        </div>
      ) : null}

      <SectionTitle label="Production, splits, and take-home" detail="Closed work for this period from appFiles/back-office exports and reconciled payout data." />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CircleDollarSign size={16} />} label="Closed GCI" value={money(production.closedGci)} detail={`${production.closedSides} closed side${production.closedSides === 1 ? "" : "s"}`} tone={agent.health} />
        <Stat icon={<Wallet size={16} />} label="My take-home" value={money(production.agentNetCommission)} detail="Agent payout from files/export, or split-based estimate" />
        <Stat
          icon={<Gauge size={16} />}
          label="Cap remaining"
          value={capRemaining}
          detail={capProgress}
          foot={<CapProgressBar value={production.capProgressPct} />}
        />
        <Stat icon={<BriefcaseBusiness size={16} />} label="Closed volume" value={money(production.closedVolume)} detail="Sales volume behind closed GCI" />
      </section>

      <SectionTitle label="45-90 day income forecast" detail="BoldTrail/appFiles pipeline converted into expected agent income, not brokerage Company Dollar." />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<BriefcaseBusiness size={16} />} label="Gross pipeline" value={money(forecast.grossPipelineGci)} detail={`${forecast.pendingDeals} active/pending deal${forecast.pendingDeals === 1 ? "" : "s"}`} />
        <Stat icon={<TrendingUp size={16} />} label="Weighted pipeline" value={money(forecast.weightedPipelineGci)} detail="Stage probability applied" />
        <Stat icon={<Wallet size={16} />} label="Projected take-home" value={money(forecast.projectedAgentNetCommission)} detail="Weighted pipeline x current split" />
        <Stat icon={<Target size={16} />} label="Income coverage" value={goalCoverage} detail={forecast.monthlyIncomeGoal != null ? `${money(forecast.monthlyIncomeGoal)} monthly target` : "Set goal during agent setup"} />
      </section>

      <SectionTitle label="Lead source ROI and accountability" detail="BoldTrail lead source and company spend matched back to appFiles/back-office closed results." />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<BarChart3 size={16} />} label="Company lead spend" value={money(leads.spend)} detail="Assigned to this agent" />
        <Stat icon={<CircleDollarSign size={16} />} label="GCI from leads" value={money(leads.attributedGci)} detail={`${leads.attributedDeals} attributed close${leads.attributedDeals === 1 ? "" : "s"}`} />
        <Stat icon={<TrendingUp size={16} />} label="Lead ROI" value={leadRoi} detail={leadNetRoi} />
        <Stat icon={<Timer size={16} />} label="Speed to lead" value={leads.speedToLeadMinutes != null ? `${Math.round(leads.speedToLeadMinutes)}m` : "Needs BoldTrail"} detail={`Appt ${appointmentConversion} - Close ${closeConversion}`} />
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <Users size={15} className="text-copper-soft" /> Activity snapshot
        </div>
        {data.activity ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Mini label="Source" value={data.activity.sourceSystem ?? "Unknown"} />
            <Mini label="New leads" value={data.activity.newLeadCount.toLocaleString()} />
            <Mini label="Contacts" value={data.activity.contactCount.toLocaleString()} />
            <Mini label="Appointments" value={data.activity.appointmentCount.toLocaleString()} />
            <Mini label="CMAs" value={data.activity.cmaCount.toLocaleString()} />
            <Mini label="Pipeline" value={data.activity.activePipelineCount.toLocaleString()} />
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Connect BoldTrail or import a CRM activity export to show lead, appointment, and activity momentum for this
            agent. appFiles/back-office data still powers closed production and cap progress.
          </p>
        )}
      </section>
    </div>
  );
}

function agentFocus(data: NonNullable<Awaited<ReturnType<typeof loadBrokerageAgentCockpitForUser>>>): string | null {
  const { production, forecast, leads } = data;
  if (forecast.incomeGoalCoveragePct != null && forecast.incomeGoalCoveragePct < 100) {
    return `Your closed plus weighted pipeline is at ${pct(forecast.incomeGoalCoveragePct, 0)} of the monthly income target. Add pipeline or move pending files forward before the next 45-90 day window thins out.`;
  }
  if (production.capRemaining != null && production.capRemaining > 0 && production.capRemaining <= 5_000) {
    return `${money(production.capRemaining)} remains before cap. Prioritize files closest to closing so more future commission shifts toward your take-home.`;
  }
  if (leads.spend > 0 && (leads.grossRoiMultiple == null || leads.grossRoiMultiple < 2)) {
    return `${money(leads.spend)} in company lead spend is assigned here, but closed-lead return is low or not matched yet. Review speed-to-lead and follow-up in BoldTrail.`;
  }
  return null;
}

function SectionTitle({ label, detail }: { label: string; detail: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-copper-soft">{label}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function CapProgressBar({ value }: { value: number | null }) {
  if (value == null) return null;
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={Math.round(safeValue)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Cap used"
    >
      <div className="h-full rounded-full bg-copper-soft" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  tone,
  foot,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: HealthStatus;
  foot?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        <span className="text-copper-soft">{icon}</span>
        {label}
      </div>
      <div className={"tnum mt-2 text-2xl " + (tone ? HEALTH_TEXT[tone] : "text-ink-text")}>{value}</div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
      {foot}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="tnum mt-1 text-lg text-ink-text">{value}</div>
    </div>
  );
}
