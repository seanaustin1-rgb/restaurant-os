/**
 * Executive Cockpit — leadership macro view for the brokerage vertical.
 * Wired to Codex's real `BrokerageCockpitData` contract (data lane owns the math).
 * No math here — every value is read straight off the contract.
 *
 * The Reputation / Market split is a VIEW choice: both tiles are sourced from the
 * contract's single `marketAura` field. Reputation trend + themes and market
 * months-of-supply / share are future contract additions; until they exist the
 * tiles degrade to honest "pending / connect" states.
 */
import type { ReactNode } from "react";
import { Banknote, Building2, Gauge, Star, TrendingUp, TrendingDown, Users, Scale } from "lucide-react";
import { money, pct } from "@/lib/format";
import type {
  BrokerageCockpitAgentRow,
  BrokerageCockpitData,
  BrokerageCockpitHealth,
} from "@/lib/modules/brokerage-analytics";

const TONE_CLASS: Record<BrokerageCockpitHealth, string> = {
  green: "border-emerald-500/40 bg-emerald-500/8 text-emerald-200",
  yellow: "border-amber-500/45 bg-amber-500/10 text-amber-200",
  red: "border-orange-500/45 bg-orange-500/10 text-orange-200",
  unknown: "border-white/10 bg-white/[0.03] text-slate-300",
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
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-300" : "text-orange-300"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
    <section className={`rounded-lg border p-4 ${TONE_CLASS[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p> : null}
      {children}
    </section>
  );
}

function AgentLine({ agent }: { agent: BrokerageCockpitAgentRow }) {
  const net = agent.companyDollar - agent.leadSpend;
  const dot = agent.health === "green" ? "bg-emerald-400" : agent.health === "yellow" ? "bg-amber-400" : "bg-orange-400";
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate text-slate-200">{agent.name}</span>
        {agent.sourceConfidence === "profile_assumption" ? (
          <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
            modeled
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-semibold text-white">{compactMoney(net)}</span>
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
  if (!market) return "Connect your MLS (RESO) for market position — months of supply & share.";
  const dom = market.medianDom != null ? `${market.medianDom}d median DOM` : "DOM pending";
  const ratio = market.activeToPendingRatio != null ? ` · ${market.activeToPendingRatio.toFixed(1)} active:pending` : "";
  const listings = market.newListings != null ? ` · ${market.newListings} new listings` : "";
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
    topPressure,
    sourceTrust,
  } = data;
  const aura = marketAura.aura;
  const market = marketAura.market;

  return (
    <article className="rounded-lg border border-white/10 bg-[#111511] p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Executive Cockpit</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{data.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{data.periodLabel} · brokerage</p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${
            sourceTrust.status === "healthy" ? TONE_CLASS.green : TONE_CLASS.yellow
          }`}
        >
          {sourceTrust.connected}/{sourceTrust.required} sources connected
        </span>
      </div>

      {/* The One Thing */}
      {topPressure ? (
        <div className="mt-5 rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">The one thing</div>
          <p className="mt-1 text-sm text-orange-100">
            <span className="font-semibold text-white">{topPressure.label}</span> — {topPressure.readout}
          </p>
        </div>
      ) : null}

      {/* HERO — Deal Health vs Ledger Health */}
      <section className="mt-5 rounded-lg border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <Scale className="h-4 w-4" aria-hidden="true" />
          <span>Deal health vs. ledger health</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-[#0f130f] p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">What the deals say</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-white">{compactMoney(dealHealth.closedGci)}</span>
              <span className="text-sm text-slate-400">closed GCI</span>
              <Trend pts={dealHealth.trendPts} />
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {compactMoney(dealHealth.pipelineGci)} pipeline · {compactMoney(dealHealth.closedVolume)} volume ·{" "}
              {dealHealth.sideCount} sides
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#0f130f] p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">What the ledger keeps</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-white">{compactMoney(ledgerHealth.companyDollar)}</span>
              <span className="text-sm text-slate-400">company dollar</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              {ledgerHealth.companyDollarPct != null ? `${pct(ledgerHealth.companyDollarPct, 1)} of GCI` : "retention pending"}
              {ledgerHealth.cashPosition != null ? ` · ${compactMoney(ledgerHealth.cashPosition)} cash` : ""}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          High volume only matters if it reaches the company. Watch the gap between top-line GCI and retained company dollar.
        </p>
      </section>

      {/* Four compact macro tiles */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CockpitCard
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          label="Company-dollar retention"
          value={cdr.pct != null ? pct(cdr.pct, 1) : "Pending"}
          detail={`Target ${pct(cdr.targetPct, 0)}. ${compactMoney(cdr.atRiskFromCaps)} at risk as agents reach cap.`}
          tone={cdr.status}
        />
        <CockpitCard
          icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
          label="Cash oxygen"
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
          icon={<Star className="h-4 w-4" aria-hidden="true" />}
          label="Reputation"
          value={aura.hasAnyData && aura.overallRating != null ? `${aura.overallRating.toFixed(1)}★` : "No data"}
          detail={
            aura.hasAnyData && aura.overallRating != null
              ? `${aura.totalReviews.toLocaleString()} reviews · trend builds once weekly snapshots accumulate.`
              : "Connect Google or Yelp to surface reputation."
          }
          tone={auraTone(aura)}
        />
        <CockpitCard
          icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
          label="Market position"
          value={market && market.medianDom != null ? `${market.medianDom}d DOM` : "Connect MLS"}
          detail={marketDetail(market)}
          tone="unknown"
        />
      </div>

      {/* Agent Production — full width so the ranked lists breathe */}
      <section className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>Agent production</span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {agentProduction.activeAgents} active · {compactMoney(agentProduction.totalCompanyDollar)} company dollar ·
          ranked by company $ net of lead spend
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Top contributors</div>
            <ul className="mt-1 divide-y divide-white/5">
              {agentProduction.topContributors.slice(0, 3).map((a) => (
                <AgentLine key={a.agentId} agent={a} />
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Watch</div>
            <ul className="mt-1 divide-y divide-white/5">
              {agentProduction.bottomContributors.slice(0, 3).map((a) => (
                <AgentLine key={a.agentId} agent={a} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Source footnote */}
      <p
        className={`mt-4 rounded-lg border px-3 py-2 text-xs leading-5 ${
          sourceTrust.status === "healthy" ? TONE_CLASS.green : TONE_CLASS.yellow
        }`}
      >
        Source trust: {sourceTrust.connected}/{sourceTrust.required} connected
        {sourceTrust.missing.length ? ` — missing ${sourceTrust.missing.slice(0, 3).join(", ")}.` : "."} Figures above
        may be partial until connected.
      </p>
    </article>
  );
}
