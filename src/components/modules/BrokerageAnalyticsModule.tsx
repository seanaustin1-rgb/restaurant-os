import { Building2, Database, Gauge, Search, TrendingUp, Users } from "lucide-react";
import { HealthSignal } from "@/components/health/HealthSignal";
import { money, pct } from "@/lib/format";
import type { BrokerageAnalyticsData, BrokerageSourceState } from "@/lib/modules/brokerage-analytics";
import type { Health } from "@/lib/demo/estimate";

const HEALTH_TEXT: Record<Health, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
};

const SOURCE_TEXT: Record<BrokerageSourceState, string> = {
  connected: "text-health-green",
  planned: "text-health-yellow",
  missing: "text-muted",
};

function stateLabel(state: BrokerageSourceState): string {
  if (state === "connected") return "Live feed connected";
  if (state === "planned") return "Planned";
  return "Live feed missing";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: Health }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={"tnum mt-1 text-xl " + (tone ? HEALTH_TEXT[tone] : "text-ink-text")}>{value}</div>
    </div>
  );
}

function Panel({
  id,
  title,
  eyebrow,
  icon,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="text-copper-soft">{icon}</span>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted">{eyebrow}</div>
          <h2 className="font-display text-xl text-ink-text">{title}</h2>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function BrokerageAnalyticsModule({ data }: { data: BrokerageAnalyticsData }) {
  const r = data.estimate;
  const totalLeadSpend = data.agents.reduce((sum, agent) => sum + agent.leadSpend, 0);
  const expectedCompanyDollar = data.agents.reduce((sum, agent) => sum + agent.expectedPipelineCompanyDollar, 0);
  const leadRoi = totalLeadSpend > 0 ? expectedCompanyDollar / totalLeadSpend : null;
  const leadHealth: Health = leadRoi == null || leadRoi >= 3 ? "green" : leadRoi >= 1.5 ? "yellow" : "red";

  return (
    <div className="space-y-5">
      {!data.hasImportedBrokerageData && (
        <div className="rounded-lg border border-copper-dim/50 bg-copper-dim/10 px-4 py-3 text-sm leading-relaxed text-ink-text-soft">
          Using setup assumptions. As you connect bank, accounting, CRM, and lead data, each one replaces the assumptions row by row — nothing here is a guess once a live feed lands.
        </div>
      )}

      <Panel id="company-dollar" title="Company Dollar" eyebrow="Brokerage operating base" icon={<Building2 size={17} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Closed GCI" value={money(r.monthlyGci)} />
          <Stat label="Company Dollar" value={money(r.companyDollar)} tone={r.companyDollarHealth} />
          <Stat label="Retained share" value={pct(r.companyDollarPct)} tone={r.companyDollarHealth} />
          <Stat label="Break-even CD" value={money(r.breakEvenCompanyDollar)} tone={r.breakEvenHealth} />
        </div>
        <HealthSignal
          status={r.companyDollarHealth}
          label={r.companyDollarHealth === "green" ? "Healthy retained share" : r.companyDollarHealth === "yellow" ? "Thin retained share" : "Company Dollar pressure"}
          detail="Company Dollar is GCI after splits, caps, referral fees, and franchise fees. It is the money available to run the brokerage."
          className="mt-4"
        />
      </Panel>

      <Panel id="commission-pipeline" title="Commission Pipeline" eyebrow="45-90 day forward read" icon={<TrendingUp size={17} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Pipeline deals" value={data.counts.pipelineDeals > 0 ? data.counts.pipelineDeals.toLocaleString() : "assumed"} />
          <Stat label="Weighted GCI" value={money(r.weightedPipelineGci)} />
          <Stat label="Expected CD" value={money(r.expectedPipelineCompanyDollar)} tone={r.pipelineHealth} />
          <Stat label="Coverage" value={`${r.pipelineMonths.toFixed(1)} mo`} tone={r.pipelineHealth} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Live CRM and transaction feeds will replace this with deal-level expected close date, probability, agent, split, and source.
        </p>
      </Panel>

      <Panel id="agent-performance" title="Agent Performance" eyebrow="Per-agent contribution" icon={<Users size={17} />}>
        <div className="space-y-3">
          {data.agents.map((agent) => (
            <div key={agent.name} className="rounded-lg border border-line bg-ink/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-ink-text">{agent.name}</div>
                  <div className={"mt-0.5 text-[11px] " + HEALTH_TEXT[agent.overallHealth]}>{agent.note}</div>
                </div>
                <span className={"rounded-full border px-2 py-0.5 text-[11px] " + HEALTH_TEXT[agent.overallHealth]}>
                  {agent.overallHealth === "green" ? "healthy" : agent.overallHealth === "yellow" ? "watch" : "pressure"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <Stat label="Company Dollar" value={money(agent.companyDollar)} tone={agent.companyDollarYieldPct >= 25 ? "green" : agent.companyDollarYieldPct >= 18 ? "yellow" : "red"} />
                <Stat label="Retained yield" value={pct(agent.companyDollarYieldPct)} />
                <Stat label="Cap remaining" value={money(agent.capRemaining)} tone={agent.capPressureHealth} />
                <Stat label="Pipeline CD" value={money(agent.expectedPipelineCompanyDollar)} />
                <Stat label="Lead ROI" value={agent.leadRoi != null ? `${agent.leadRoi.toFixed(1)}x` : "-"} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel id="market-intelligence" title="Market Intelligence" eyebrow="Market energy" icon={<Search size={17} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="Market score" value={Math.round(data.market.marketAuraScore).toLocaleString()} tone={data.market.marketAuraHealth} />
          <Stat label="Contract velocity" value={Math.round(data.market.contractVelocityScore).toLocaleString()} />
          <Stat label="DOM pressure" value={Math.round(data.market.domPressureScore).toLocaleString()} />
          <Stat label="Showing demand" value={Math.round(data.market.showingDemandScore).toLocaleString()} />
        </div>
        <p className={"mt-3 text-xs leading-relaxed " + HEALTH_TEXT[data.market.marketAuraHealth]}>{data.market.note}</p>
      </Panel>

      <Panel id="lead-roi" title="Lead ROI" eyebrow="Source spend vs retained return" icon={<Gauge size={17} />}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Stat label="Lead spend" value={money(totalLeadSpend)} />
          <Stat label="Expected Company Dollar" value={money(expectedCompanyDollar)} tone={leadHealth} />
          <Stat label="Expected ROI" value={leadRoi != null ? `${leadRoi.toFixed(1)}x` : "-"} tone={leadHealth} />
        </div>
      </Panel>

      <Panel id="source-readiness" title="Source Readiness" eyebrow="What makes this live" icon={<Database size={17} />}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.sourceReadiness.map((source) => (
            <div key={source.label} className="rounded-lg border border-line bg-ink/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-ink-text">{source.label}</div>
                <span className={"text-[11px] uppercase tracking-wider " + SOURCE_TEXT[source.state]}>{stateLabel(source.state)}</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{source.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
