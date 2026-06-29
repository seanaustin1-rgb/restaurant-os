/**
 * Generate a FICTITIOUS BrokerageImportPayload for the "Cascade Realty Group"
 * sales-demo tenant — shaped like a Brokermint / Sisu / BoldTrail export so the
 * brokerage import + analytics modules render fully populated.
 *
 * The output conforms to BrokerageImportPayload (see
 * src/lib/brokerage/normalized-import.ts): { agents, deals, leadSpend }.
 *
 * Used two ways:
 *   1. As a CLI to print/write the JSON payload (inspect a back-office export):
 *        npx tsx scripts/generate-brokerage-pilot-payload.ts            # prints to stdout
 *        npx tsx scripts/generate-brokerage-pilot-payload.ts --out p.json
 *   2. As a library — scripts/seed-demo-brokerage.ts imports buildBrokeragePayload()
 *      and commits it via commitBrokerageImport().
 *
 * Everything is fictitious. Dates are anchored to "now" so CLOSED deals land in
 * the current month (the dashboard's period follows the latest closed deal) and
 * PENDING deals fall 30–60 days out. Math.random is used freely (like seed-demo.ts);
 * re-running produces a fresh-but-equivalent dataset.
 */
import { writeFileSync } from "node:fs";
import type {
  BrokerageImportPayload,
  RawBrokerageAgent,
  RawBrokerageDeal,
  RawBrokerageLeadSpend,
} from "../src/lib/brokerage/normalized-import";

// ── Time anchors ──────────────────────────────────────────────────────────────
const NOW = new Date();
const YEAR = NOW.getUTCFullYear();
const MONTH0 = NOW.getUTCMonth();

function isoDay(year: number, month0: number, day: number): string {
  return new Date(Date.UTC(year, month0, day)).toISOString().slice(0, 10);
}

/** A date `offset` days from today (negative = past), as YYYY-MM-DD. */
function isoFromToday(offsetDays: number): string {
  const d = new Date(NOW.getTime());
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.round(rand(min, max));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ── Markets ──────────────────────────────────────────────────────────────────
export const BROKERAGE_MARKETS = ["Boise, ID", "Meridian, ID", "Nampa, ID"] as const;

// ── Agent roster (~12) ─────────────────────────────────────────────────────────
const AGENT_NAMES = [
  "Hannah Whitaker",
  "Marcus DeLuca",
  "Priya Nadkarni",
  "Tyler Brooks",
  "Sofia Reyes",
  "Jordan Albright",
  "Elena Vasquez",
  "Cameron Stout",
  "Dana Kowalczyk",
  "Aaron Feldman",
  "Brittany Cho",
  "Wesley Okafor",
] as const;

function externalAgentId(index: number): string {
  return `CRG-AGT-${String(index + 1).padStart(3, "0")}`;
}

function emailFor(name: string): string {
  const handle = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/(^\.|\.$)/g, "");
  return `${handle}@cascaderealtygroup.com`;
}

interface BuiltAgent {
  raw: RawBrokerageAgent;
  defaultSplitPct: number;
}

function buildAgents(): BuiltAgent[] {
  // Cap resets at the start of the current calendar year (anniversary model).
  const capResetDate = isoDay(YEAR, 0, 1);
  return AGENT_NAMES.map((name, i) => {
    // Two newest hires are still onboarding.
    const status = i >= AGENT_NAMES.length - 2 ? "onboarding" : "active";
    const defaultSplitPct = randInt(60, 85);
    const annualCap = randInt(18_000, 25_000);
    // Onboarding agents have paid little toward cap; veterans are part-way.
    const capPaid =
      status === "onboarding"
        ? round2(rand(0, 2_500))
        : round2(annualCap * rand(0.15, 0.85));
    return {
      defaultSplitPct,
      raw: {
        externalAgentId: externalAgentId(i),
        name,
        email: emailFor(name),
        status,
        defaultSplitPct,
        annualCap,
        capPaid,
        capResetDate,
        rawPayload: {
          source: "brokermint",
          roster_id: externalAgentId(i),
          office: pick(BROKERAGE_MARKETS),
          license_status: status === "onboarding" ? "pending_board" : "active",
        },
      },
    };
  });
}

// ── Deals (~60) ────────────────────────────────────────────────────────────────
const STREETS = [
  "Maple Ridge Ct",
  "Cobalt Sky Ln",
  "Harvest Moon Dr",
  "Silver Sage Way",
  "Quarry Bluff Rd",
  "Aspen Hollow Pl",
  "Foxtail Meadow Ave",
  "Riverstone Pkwy",
  "Cedar Vista Blvd",
  "Lupine Field St",
  "Granite Peak Cir",
  "Willow Bend Loop",
];

type Stage = "CLOSED" | "PENDING" | "ACTIVE" | "LEAD" | "LOST";

// Target mix across ~60 deals.
const STAGE_PLAN: Stage[] = [
  ...Array<Stage>(22).fill("CLOSED"),
  ...Array<Stage>(12).fill("PENDING"),
  ...Array<Stage>(14).fill("ACTIVE"),
  ...Array<Stage>(8).fill("LEAD"),
  ...Array<Stage>(4).fill("LOST"),
];

function dealAddress(i: number): string {
  return `${randInt(100, 9999)} ${STREETS[i % STREETS.length]}`;
}

function buildDeals(agents: BuiltAgent[]): RawBrokerageDeal[] {
  return STAGE_PLAN.map((stage, i) => {
    const agent = pick(agents);
    const market = pick(BROKERAGE_MARKETS);
    const salePrice = round2(rand(250_000, 1_200_000));
    const commissionPct = rand(2.5, 3.0);
    const gci = round2(salePrice * (commissionPct / 100));
    const agentSplitPct = agent.defaultSplitPct;

    // Pass-throughs on a subset of deals (franchise model + referrals happen).
    const franchiseFee = Math.random() < 0.4 ? round2(gci * 0.06) : 0; // ~6% franchise
    const referralFee = Math.random() < 0.2 ? round2(gci * rand(0.2, 0.25)) : 0;

    let stageStr: Stage = stage;
    let closedDate: string | null = null;
    let expectedCloseDate: string | null = null;
    let probabilityPct: number | null = null;

    switch (stage) {
      case "CLOSED":
        // Spread CLOSED across the current month so MTD analytics is populated.
        closedDate = isoDay(YEAR, MONTH0, randInt(1, Math.min(28, new Date(Date.UTC(YEAR, MONTH0 + 1, 0)).getUTCDate())));
        probabilityPct = 100;
        break;
      case "PENDING":
        expectedCloseDate = isoFromToday(randInt(30, 60));
        probabilityPct = randInt(75, 95);
        break;
      case "ACTIVE":
        expectedCloseDate = isoFromToday(randInt(45, 110));
        probabilityPct = randInt(40, 70);
        break;
      case "LEAD":
        expectedCloseDate = isoFromToday(randInt(90, 180));
        probabilityPct = randInt(10, 35);
        break;
      case "LOST":
        probabilityPct = 0;
        break;
    }

    return {
      externalDealId: `CRG-DEAL-${String(i + 1).padStart(4, "0")}`,
      agentExternalId: agent.raw.externalAgentId,
      label: `${dealAddress(i)}, ${market.split(",")[0]}`,
      market,
      stage: stageStr,
      expectedCloseDate,
      closedDate,
      salePrice,
      gci,
      agentSplitPct,
      referralFee,
      franchiseFee,
      probabilityPct,
      rawPayload: {
        source: "brokermint",
        transaction_id: `CRG-DEAL-${String(i + 1).padStart(4, "0")}`,
        side: pick(["listing", "buyer", "dual"]),
        sale_price: salePrice,
        commission_pct: round2(commissionPct),
      },
    } satisfies RawBrokerageDeal;
  });
}

// ── Lead spend (last ~6 months by source) ────────────────────────────────────
const LEAD_SOURCES = [
  { source: "Zillow", monthly: [3200, 4200] as const, gciMult: [2.0, 4.5] as const },
  { source: "Realtor.com", monthly: [1800, 2600] as const, gciMult: [1.5, 3.5] as const },
  { source: "Google Ads", monthly: [1200, 2200] as const, gciMult: [1.8, 4.0] as const },
  { source: "Facebook", monthly: [600, 1400] as const, gciMult: [1.0, 3.0] as const },
] as const;

function buildLeadSpend(agents: BuiltAgent[]): RawBrokerageLeadSpend[] {
  const rows: RawBrokerageLeadSpend[] = [];
  for (let monthsBack = 5; monthsBack >= 0; monthsBack--) {
    const ref = new Date(Date.UTC(YEAR, MONTH0 - monthsBack, 1));
    const y = ref.getUTCFullYear();
    const m = ref.getUTCMonth();
    const periodStart = isoDay(y, m, 1);
    const periodEnd = isoDay(y, m, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    for (const src of LEAD_SOURCES) {
      const spend = round2(rand(src.monthly[0], src.monthly[1]));
      const attributedGci = round2(spend * rand(src.gciMult[0], src.gciMult[1]));
      const attributedDeals = randInt(0, 3);
      rows.push({
        externalLeadSpendId: `CRG-LEAD-${src.source.replace(/\W+/g, "")}-${y}${String(m + 1).padStart(2, "0")}`,
        // Lead spend is brokerage-level (no agent attribution) for most rows.
        agentExternalId: Math.random() < 0.25 ? pick(agents).raw.externalAgentId : null,
        source: src.source,
        periodStart,
        periodEnd,
        spend,
        attributedGci,
        attributedDeals,
        rawPayload: { source: "sisu", channel: src.source, period: `${y}-${String(m + 1).padStart(2, "0")}` },
      });
    }
  }
  return rows;
}

// ── Public builder ─────────────────────────────────────────────────────────────
export interface BuiltBrokeragePayload {
  payload: BrokerageImportPayload;
  /** Markets referenced by the deals (for market-metric seeding). */
  markets: string[];
}

export function buildBrokeragePayload(): BuiltBrokeragePayload {
  const agents = buildAgents();
  const deals = buildDeals(agents);
  const leadSpend = buildLeadSpend(agents);
  return {
    payload: {
      agents: agents.map((a) => a.raw),
      deals,
      leadSpend,
    },
    markets: [...BROKERAGE_MARKETS],
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────────
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function isMain(): boolean {
  const entry = process.argv[1] ?? "";
  return entry.includes("generate-brokerage-pilot-payload");
}

if (isMain()) {
  const { payload } = buildBrokeragePayload();
  const json = JSON.stringify(payload, null, 2);
  const out = arg("--out");
  if (out) {
    writeFileSync(out, json);
    console.error(
      `Wrote ${payload.agents?.length ?? 0} agents, ${payload.deals?.length ?? 0} deals, ${payload.leadSpend?.length ?? 0} lead-spend rows to ${out}`,
    );
  } else {
    process.stdout.write(json + "\n");
  }
}
