/**
 * Executive Cockpit — leadership macro view for the brokerage vertical.
 * Wired to Codex's real `BrokerageCockpitData` contract (data lane owns the math).
 * No math here — every value is read straight off the contract.
 *
 * Rendered in the OutFront Data design system (DESIGN.md): matte Ink ground,
 * Surface panels, hairline Line borders, Space Mono figures via `.tnum`, serif
 * (font-display) headings, and a strictly-separate health vocabulary that never
 * relies on color alone. Copper is rationed to the single "one thing" callout.
 *
 * The Reputation / Market split is a VIEW choice: both tiles are sourced from the
 * contract's single `marketAura` field. Reputation trend + themes and market
 * months-of-supply / share are future contract additions; until they exist the
 * tiles degrade to honest "pending / connect" states.
 */
import type { ReactNode } from "react";
import { Banknote, Building2, Gauge, Star, TrendingUp, TrendingDown, Users, Scale } from "lucide-react";
import { HealthSignal } from "@/components/health/HealthSignal";
import { LukeFirstLoginPanel } from "@/components/cockpit/LukeFirstLoginPanel";
import { orderByNeedsAttention } from "@/lib/cockpit/needs-attention";
import { money, pct } from "@/lib/format";
import type {
  BrokerageCockpitAgentRow,
  BrokerageCockpitData,
  BrokerageCockpitHealth,
} from "@/lib/modules/brokerage-analytics";

// Value color follows financial health; unknown falls back to primary Ink Text.
// The word/icon (HealthSignal) carries the honest read — color is the fast read only.
const HEALTH_TEXT: Record<BrokerageCockpitHealth, string> = {
  green: "text-health-green",
  yellow: "text-health-yellow",
  red: "text-health-red",
  unknown: "text-ink-text",
};

const CARD_TONE_PANEL: Record<BrokerageCockpitHealth, string> = {
  green: "border-health-green/25 bg-health-green/5",
  yellow: "border-health-yellow/30 bg-health-yellow/5",
  red: "border-health-red/35 bg-health-red/5",
  unknown: "border-line bg-ink/40",
};

const HEALTH_WORD: Record<Exclude<BrokerageCockpitHealth, "unknown">, string> = {
  green: "On track",
  yellow: "Watch",
  red: "Off target",
};

// Tinted status pill for the source-trust badge (DESIGN status-badge shape).
const SOURCE_BADGE: Record<"healthy" | "partial", string> = {
  healthy: "border-health-green/30 bg-health-green/10 text-health-green",
  partial: "border-health-yellow/30 bg-health-yellow/10 text-health-yellow",
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
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-health-green" : "text-health-red"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="tnum">
        {up ? "+" : ""}
        {pts.toFixed(1)} pts
      </span>
    </span>
  );
}

function CockpitCard({
  icon,
  label,
  value,
  tone = "unknown",
  detail,
  signal,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: BrokerageCockpitHealth;
  detail?: string;
  signal?: ReactNode;
}) {
  return (
    <section className={`rounded-lg border p-4 ${CARD_TONE_PANEL[tone]}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        <span className="text-copper-soft">{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`tnum mt-3 text-2xl ${HEALTH_TEXT[tone]}`}>{value}</div>
      {signal ?? null}
      {detail ? <p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p> : null}
    </section>
  );
}

function AgentLine({ agent }: { agent: BrokerageCockpitAgentRow }) {
  const net = agent.companyDollar - agent.leadSpend;
  const dot =
    agent.health === "green" ? "bg-health-green" : agent.health === "yellow" ? "bg-health-yellow" : "bg-health-red";
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="truncate text-ink-text">{agent.name}</span>
        {agent.sourceConfidence === "profile_assumption" ? (
          <span className="shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            modeled
          </span>
        ) : null}
      </span>
      <span className="tnum shrink-0 text-ink-text">{compactMoney(net)}</span>
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

export function ExecutiveCockpit({
  data,
  ownerFirstName = "Luke",
  ownerUserId = "public-demo",
}: {
  data: BrokerageCockpitData;
  ownerFirstName?: string;
  ownerUserId?: string;
}) {
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
  const cdrTone = cdr.status;
  const cashTone = cashSafety.status;
  const repTone = auraTone(aura);
  // Early-action list: unhealthy agents raised to the top (red before yellow, then
  // biggest company dollar at risk first). Falls back to lowest producers when all green.
  const needsAction = orderByNeedsAttention(
    agentProduction.allAgents,
    (a) => a.health,
    (a, b) => b.companyDollar - a.companyDollar,
  ).slice(0, 3);
  const oneThing = topPressure ?? {
    label: "You're clear today",
    readout:
      cdr.pct != null
        ? `Company-dollar retention is ${pct(cdr.pct, 1)}. Keep the current operating rhythm.`
        : `Closed GCI is ${compactMoney(dealHealth.closedGci)} for the current period.`,
  };
  const sourceTrustText = `Source trust: ${sourceTrust.connected}/${sourceTrust.required} connected${
    sourceTrust.missing.length ? `; missing ${sourceTrust.missing.slice(0, 3).join(", ")}.` : "."
  } Figures remain partial until planned sources are connected or imported.`;

  return (
    <article className="rounded-lg border border-line bg-surface px-4 py-4 sm:px-5 sm:py-5">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-copper-soft">
            Brokerage Executive Cockpit
          </div>
          <h2 className="mt-2 font-display text-3xl text-ink-text">{data.name}</h2>
          <p className="mt-1 text-sm text-muted">{data.periodLabel} · brokerage</p>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${SOURCE_BADGE[sourceTrust.status]}`}
        >
          <span className="tnum">
            {sourceTrust.connected}/{sourceTrust.required}
          </span>{" "}
          sources connected
        </span>
      </div>

      <LukeFirstLoginPanel
        restaurantId={data.restaurantId}
        userId={ownerUserId}
        firstName={ownerFirstName}
        executiveBrief={[
          `${compactMoney(dealHealth.closedGci)} closed GCI; ${compactMoney(ledgerHealth.companyDollar)} reached company dollar.`,
          cashSafety.oxygenDays != null
            ? `Cash oxygen is ${Math.floor(cashSafety.oxygenDays)} days against a ${cashSafety.floorDaysTarget}-day floor.`
            : "Cash oxygen needs a starting balance before it can be measured.",
        ]}
        oneThing={oneThing}
        sourceTrust={sourceTrustText}
      />

      {/* HERO — Deal Health vs Ledger Health */}
      <section className="mt-5 rounded-lg border border-line bg-ink/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          <Scale className="h-4 w-4 text-copper-soft" aria-hidden="true" />
          <span>Deal Health vs. Ledger Health</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted">What the deals say</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="tnum text-3xl text-ink-text">{compactMoney(dealHealth.closedGci)}</span>
              <span className="text-sm text-muted">closed GCI</span>
              <Trend pts={dealHealth.trendPts} />
            </div>
            <p className="mt-2 text-sm text-muted">
              <span className="tnum">{compactMoney(dealHealth.pipelineGci)}</span> pipeline ·{" "}
              <span className="tnum">{compactMoney(dealHealth.closedVolume)}</span> volume ·{" "}
              <span className="tnum">{dealHealth.sideCount}</span> sides
            </p>
          </div>
          <div className={`rounded-lg border p-4 ${CARD_TONE_PANEL[ledgerHealth.status]}`}>
            <div className="text-[11px] uppercase tracking-wider text-muted">What the ledger keeps</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`tnum text-3xl ${HEALTH_TEXT[ledgerHealth.status]}`}>
                {compactMoney(ledgerHealth.companyDollar)}
              </span>
              <span className="text-sm text-muted">company dollar</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              {ledgerHealth.companyDollarPct != null ? (
                <>
                  <span className="tnum">{pct(ledgerHealth.companyDollarPct, 1)}</span> of GCI
                </>
              ) : (
                "retention pending"
              )}
              {ledgerHealth.cashPosition != null ? (
                <>
                  {" · "}
                  <span className="tnum">{compactMoney(ledgerHealth.cashPosition)}</span> cash
                </>
              ) : null}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          High volume only matters if it reaches the company. Watch the gap between top-line GCI and retained company
          dollar.
        </p>
      </section>

      {/* Four compact macro tiles */}
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <CockpitCard
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          label="Company-dollar retention"
          value={cdr.pct != null ? pct(cdr.pct, 1) : "Pending"}
          tone={cdrTone}
          signal={
            cdrTone !== "unknown" ? (
              <HealthSignal
                status={cdrTone}
                label={HEALTH_WORD[cdrTone]}
                detail={`vs ${pct(cdr.targetPct, 0)} target`}
                className="mt-2"
              />
            ) : undefined
          }
          detail={`${compactMoney(cdr.atRiskFromCaps)} at risk as agents reach cap.`}
        />
        <CockpitCard
          icon={<Banknote className="h-4 w-4" aria-hidden="true" />}
          label="Cash oxygen"
          value={cashSafety.oxygenDays != null ? `${Math.floor(cashSafety.oxygenDays)} days` : "Anchor needed"}
          tone={cashTone}
          signal={
            cashTone !== "unknown" ? (
              <HealthSignal
                status={cashTone}
                label={HEALTH_WORD[cashTone]}
                detail={`floor ${cashSafety.floorDaysTarget}d`}
                className="mt-2"
              />
            ) : undefined
          }
          detail={
            cashSafety.netCashChangePeriod != null
              ? `${cashSafety.netCashChangePeriod >= 0 ? "+" : ""}${compactMoney(cashSafety.netCashChangePeriod)} this period.`
              : `Floor target ${cashSafety.floorDaysTarget} days.`
          }
        />
        <CockpitCard
          icon={<Star className="h-4 w-4" aria-hidden="true" />}
          label="Reputation"
          value={aura.hasAnyData && aura.overallRating != null ? `${aura.overallRating.toFixed(1)}★` : "No data"}
          tone={repTone}
          detail={
            aura.hasAnyData && aura.overallRating != null
              ? `${aura.totalReviews.toLocaleString()} reviews · trend builds once weekly snapshots accumulate.`
              : "Connect Google or Yelp to surface reputation."
          }
        />
        <CockpitCard
          icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
          label="Market position"
          value={market && market.medianDom != null ? `${market.medianDom}d DOM` : "Connect MLS"}
          detail={marketDetail(market)}
          tone="unknown"
        />
      </div>

      <div className="mt-3 grid gap-3 text-xs leading-relaxed text-muted md:grid-cols-2">
        <p className="rounded-lg border border-line bg-ink/40 px-3 py-2">
          Reputation trend:{" "}
          {reputationTrend.state === "ready" && reputationTrend.ratingTrendPts != null
            ? `${reputationTrend.ratingTrendPts >= 0 ? "+" : ""}${reputationTrend.ratingTrendPts.toFixed(1)} rating points`
            : reputationTrend.state === "gathering"
              ? "gathering weekly snapshots"
              : "connect Google or review sources"}
          {reputationTrend.themes.summary ? ` - ${reputationTrend.themes.summary}` : ""}.
        </p>
        <p className="rounded-lg border border-line bg-ink/40 px-3 py-2">
          Market position:{" "}
          {marketPosition.source === "not_connected"
            ? "connect RESO/MLS or add profile market assumptions"
            : `${marketPosition.note}${
                marketPosition.monthsOfSupply != null ? ` ${marketPosition.monthsOfSupply.toFixed(1)} months supply.` : ""
              }${marketPosition.marketSharePct != null ? ` ${pct(marketPosition.marketSharePct, 1)} share.` : ""}`}
        </p>
      </div>

      {/* Agent Production — full width so the ranked lists breathe */}
      <section className="mt-4 rounded-lg border border-line bg-ink/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          <Users className="h-4 w-4 text-copper-soft" aria-hidden="true" />
          <span>Agent production</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          <span className="tnum">{agentProduction.activeAgents}</span> active ·{" "}
          <span className="tnum">{compactMoney(agentProduction.totalCompanyDollar)}</span> company dollar · ranked by
          company $ net of lead spend
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted">Top contributors</div>
            <ul className="mt-1 divide-y divide-line">
              {agentProduction.topContributors.slice(0, 3).map((a) => (
                <AgentLine key={a.agentId} agent={a} />
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted">
              {needsAction.length ? "Needs attention" : "Watch"}
            </div>
            <ul className="mt-1 divide-y divide-line">
              {(needsAction.length ? needsAction : agentProduction.bottomContributors.slice(0, 3)).map((a) => (
                <AgentLine key={a.agentId} agent={a} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Source footnote */}
      <p className={`mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed ${SOURCE_BADGE[sourceTrust.status]}`}>
        Source trust: <span className="tnum">{sourceTrust.connected}/{sourceTrust.required}</span> connected
        {sourceTrust.missing.length ? ` — missing ${sourceTrust.missing.slice(0, 3).join(", ")}.` : "."} Figures above
        may be partial until connected.
      </p>
    </article>
  );
}
