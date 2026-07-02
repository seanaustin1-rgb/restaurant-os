import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, BriefcaseBusiness, CircleDollarSign, Gauge, Users } from "lucide-react";
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

  const selectedRestaurantId = searchParams?.restaurantId ?? roles[0]?.restaurantId ?? null;
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
            Per-agent production, cap pressure, pipeline, and activity. Leadership can select agents; agent-scoped users
            only resolve their own email/source identity.
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
  const leadRoi = agent.roi != null ? `${agent.roi.toFixed(1)}x` : "No spend";
  const retainedYield = agent.retainedYield != null ? `${pct(agent.retainedYield, 1)} retained yield` : "Retained yield pending";
  const capProgress = agent.capProgressPct != null ? `${Math.round(agent.capProgressPct)}% of cap used` : "No cap tracked";
  const capRemaining = agent.capRemaining != null ? money(agent.capRemaining) : "No cap";
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

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CircleDollarSign size={16} />} label="Company Dollar" value={money(agent.companyDollar)} detail={retainedYield} tone={agent.health} />
        <Stat icon={<Gauge size={16} />} label="Cap remaining" value={capRemaining} detail={capProgress} />
        <Stat icon={<BriefcaseBusiness size={16} />} label="Pipeline CD" value={money(agent.pipelineCompanyDollar)} detail="Weighted future company dollar" />
        <Stat icon={<BarChart3 size={16} />} label="Lead ROI" value={leadRoi} detail={`${money(agent.leadSpend)} lead spend`} />
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
            Connect Follow Up Boss, MoxiWorks, BoldTrail, or a CRM export to show lead and activity momentum for this
            agent.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: HealthStatus;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
        <span className="text-copper-soft">{icon}</span>
        {label}
      </div>
      <div className={"tnum mt-2 text-2xl " + (tone ? HEALTH_TEXT[tone] : "text-ink-text")}>{value}</div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
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
