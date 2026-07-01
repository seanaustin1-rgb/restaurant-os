/**
 * Executive Cockpit - leadership macro view for the brokerage vertical.
 * Data lane owns all math; this component only renders the instrument panel.
 */
import type { ReactNode } from "react";
import { Banknote, Building2, Gauge, Scale, Star, TrendingDown, TrendingUp, Users } from "lucide-react";
import { money, pct } from "@/lib/format";
import type {
  BrokerageCockpitAgentRow,
  BrokerageCockpitData,
  BrokerageCockpitHealth,
} from "@/lib/modules/brokerage-analytics";

const TONE_BORDER: Record<BrokerageCockpitHealth, string> = {
  green: "border-health-green/35 bg-health-green/5",
  yellow: "border-health-yellow/35 bg-health-yellow/5",
  red: "border-health-red/40 bg-health-red/5",
  unknown: "border-line bg-surface",
};

const TONE_TEXT: Record<BrokerageCockpitHealth, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
  unknown: "text-muted",
};

const STATUS_LABEL: Record<BrokerageCockpitHealth, string> = {
  green: "On track",
  yellow: "Watch",
  red: "Pressure",
  unknown: "Pending",
};

function compactMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return money(n);
}

function Trend({ pts }: { pts: number | null }) {
  if (pts == null) return null;
  const up = pts >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={"inline-flex items-center gap-1 text-xs " + (up ? "text-health-green" : "text-health-red")}>
      <Icon size={13} aria-hidden="true" />
      {up ? "+" : ""}
      {pts.toFixed(1)} pts
    </span>
  );
}

function CockpitCard({
  icon,
  label,
  value,
  detail,
  tone = "unknown",
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: BrokerageCockpitHealth;
  children?: ReactNode;
}) {
  return (
    <section className={"rounded-lg border px-4 py-4 " + TONE_BORDER[tone]}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <span className="text-copper-soft">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <span className={"shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] " + TONE_TEXT[tone]}>
          {STATUS_LABEL[tone]}
        </span>
      </div>
      <div className="tnum mt-3 text-2xl text-ink-text">{value}</div>
      {detail ? <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p> : null}
      {children}
    </section>
  );
}

function Instrument({
  label,
  value,
  subvalue,
  tone = "unknown",
  trend,
}: {
  label: string;
  value: string;
  subvalue: string;
  tone?: BrokerageCockpitHealth;
  trend?: ReactNode;
}) {
  return (
    <div className={"rounded-lg border px-4 py-4 " + TONE_BORDER[tone]}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
        {trend}
      </div>
      <div className="tnum mt-3 text-3xl text-ink-text">{value}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{subvalue}</p>
    </div>
  );
}

function AgentLine({ agent }: { agent: BrokerageCockpitAgentRow }) {
  const net = agent.companyDollar - agent.leadSpend;
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="flex min-w-0 items-center gap-2">
        <span className={"h-2 w-2 shrink-0 rounded-full " + (agent.health === "green" ? "bg-health-green" : agent.health === "yellow" ? "bg-health-yellow" : "bg-health-red")} aria-hidden="true" />
        <span className="truncate text-sm text-ink-text">{agent.name}</span>
        {agent.sourceConfidence === "profile_assumption" ? (
          <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-muted">modeled</span>
        ) : null}
      </span>
      <span className="tnum shrink-0 text-sm text-ink-text">{compactMoney(net)}</span>
    </li>
  );
}

function auraTone(aura: BrokerageCockpitData["marketAura"]["aura"]): BrokerageCockpitHealth {
  if (!aura.hasAnyData || aura.overallRating == null) return "unknown";
  if (aura.overallRating >= 4.2) return "green";
  if (aura.overallRating >= 3.7) return "yellow";
  return "red";
}

function marketDetail(market: BrokerageCockpitData["marketAura"]["market"]): string {
  if (!market) return "Connect RESO/MLS for months of supply, DOM, and share.";
  const dom = market.medianDom != null ? `${market.medianDom}d median DOM` : "DOM pending";
  const ratio = market.activeToPendingRatio != null ? `; ${market.activeToPendingRatio.toFixed(1)} active:pending` : "";
  const listings = market.newListings != null ? `; ${market.newListings} new listings` : "";
  return `${dom}${ratio}${listings}.`;
}

export function ExecutiveCockpit({ data }: { data: BrokerageCockpitData }) {
  const {
    dealHealth,
    ledgerHealth,
    companyDollarRetention: cdr,
    cashSafety,
    agentProduction,
    marketAura,
    reputationTrend,
    marketPosition,
    topPressure,
    sourceTrust,
  } = data;
  const aura = marketAura.aura;
  const market = marketAura.market;

  return (
    <article className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Brokerage Executive Cockpit</div>
          <h2 className="mt-1 font-display text-3xl text-ink-text">{data.name}</h2>
          <p className="mt-1 text-sm text-muted">{data.periodLabel} - leadership read</p>
        </div>
        <span
          className={
            "w-fit rounded-full border px-3 py-1 text-xs " +
            (sourceTrust.status === "healthy"
              ? "border-health-green/35 bg-health-green/10 text-health-green"
              : "border-health-yellow/35 bg-health-yellow/10 text-health-yellow")
          }
        >
          {sourceTrust.connected}/{sourceTrust.required} sources connected
        </span>
      </div>

      {topPressure ? (
        <section className="mt-4 rounded-lg border border-copper-dim bg-copper/10 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">One thing first</div>
          <p className="mt-1 text-sm leading-relaxed text-ink-text">
            <span className="font-medium text-copper-soft">{topPressure.label}</span>: {topPressure.readout}
          </p>
        </section>
      ) : null}

      <section className="mt-4 rounded-lg border border-line bg-ink/40 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <Scale size={15} className="text-copper-soft" aria-hidden="true" />
          Deal Health vs. Ledger Health
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Instrument
            label="What the deals say"
            value={compactMoney(dealHealth.closedGci)}
            subvalue={`${compactMoney(dealHealth.pipelineGci)} pipeline; ${compactMoney(dealHealth.closedVolume)} volume; ${dealHealth.sideCount} sides`}
            trend={<Trend pts={dealHealth.trendPts} />}
          />
          <Instrument
            label="What the ledger keeps"
            value={compactMoney(ledgerHealth.companyDollar)}
            subvalue={`${ledgerHealth.companyDollarPct != null ? `${pct(ledgerHealth.companyDollarPct, 1)} of GCI` : "retention pending"}${ledgerHealth.cashPosition != null ? `; ${compactMoney(ledgerHealth.cashPosition)} cash` : ""}`}
            tone={ledgerHealth.status}
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          High volume only matters if it reaches the company. This is the cockpit split between deal activity and usable
          operating dollars.
        </p>
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CockpitCard
          icon={<Gauge size={14} aria-hidden="true" />}
          label="Company Dollar"
          value={cdr.pct != null ? pct(cdr.pct, 1) : "Pending"}
          detail={`Target ${pct(cdr.targetPct, 0)}. ${compactMoney(cdr.atRiskFromCaps)} at risk as agents reach cap.`}
          tone={cdr.status}
        />
        <CockpitCard
          icon={<Banknote size={14} aria-hidden="true" />}
          label="Cash Oxygen"
          value={cashSafety.oxygenDays != null ? `${Math.floor(cashSafety.oxygenDays)} days` : "Anchor needed"}
          detail={
            `Floor target ${cashSafety.floorDaysTarget} days.` +
            (cashSafety.netCashChangePeriod != null
              ? ` ${cashSafety.netCashChangePeriod >= 0 ? "+" : ""}${compactMoney(cashSafety.netCashChangePeriod)} this period.`
              : "")
          }
          tone={cashSafety.status}
        />
        <CockpitCard
          icon={<Star size={14} aria-hidden="true" />}
          label="Reputation"
          value={aura.hasAnyData && aura.overallRating != null ? `${aura.overallRating.toFixed(1)} stars` : "No data"}
          detail={
            aura.hasAnyData && aura.overallRating != null
              ? `${aura.totalReviews.toLocaleString()} reviews. ${
                  reputationTrend.state === "ready" && reputationTrend.ratingTrendPts != null
                    ? `${reputationTrend.ratingTrendPts >= 0 ? "+" : ""}${reputationTrend.ratingTrendPts.toFixed(1)} rating trend.`
                    : "Trend is gathering weekly snapshots."
                }`
              : "Connect Google or review sources to surface reputation."
          }
          tone={auraTone(aura)}
        />
        <CockpitCard
          icon={<Building2 size={14} aria-hidden="true" />}
          label="Market Position"
          value={
            marketPosition.monthsOfSupply != null
              ? `${marketPosition.monthsOfSupply.toFixed(1)} mo supply`
              : market && market.medianDom != null
                ? `${market.medianDom}d DOM`
                : "Connect MLS"
          }
          detail={
            marketPosition.source !== "not_connected"
              ? `${marketPosition.note}${marketPosition.marketSharePct != null ? ` Share: ${pct(marketPosition.marketSharePct, 1)}.` : ""}`
              : marketDetail(market)
          }
          tone="unknown"
        />
      </div>

      <section className="mt-4 rounded-lg border border-line bg-ink/40 p-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <Users size={15} className="text-copper-soft" aria-hidden="true" />
          Agent Production
        </div>
        <p className="mt-1 text-sm text-muted">
          <span className="tnum text-ink-text">{agentProduction.activeAgents}</span> active;{" "}
          <span className="tnum text-ink-text">{compactMoney(agentProduction.totalCompanyDollar)}</span> company dollar;
          ranked by company dollar net of lead spend.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface px-3 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted">Top contributors</div>
            <ul className="mt-2">
              {agentProduction.topContributors.slice(0, 3).map((a) => (
                <AgentLine key={a.agentId} agent={a} />
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted">Watch list</div>
            <ul className="mt-2">
              {agentProduction.bottomContributors.slice(0, 3).map((a) => (
                <AgentLine key={a.agentId} agent={a} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      <p
        className={
          "mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed " +
          (sourceTrust.status === "healthy"
            ? "border-health-green/35 bg-health-green/10 text-health-green"
            : "border-health-yellow/35 bg-health-yellow/10 text-health-yellow")
        }
      >
        Source trust: {sourceTrust.connected}/{sourceTrust.required} connected
        {sourceTrust.missing.length ? `; missing ${sourceTrust.missing.slice(0, 3).join(", ")}.` : "."} Figures may be
        partial until connected.
      </p>
    </article>
  );
}
