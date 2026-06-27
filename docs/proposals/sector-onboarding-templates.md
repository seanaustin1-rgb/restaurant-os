# Sector-aware onboarding templates

**Status:** spec-of-record (design/spec track). The numbers and structure here are
the canonical reference Codex builds against. Engine generalization (phase 2) is
tracked separately — see the caveat section. Not yet wired into the live
`src/lib/industry-templates.ts` / `src/app/onboarding/*`; those are the
engineering track's to change.

> **2026-06-27 revision (this pass):** seed splits re-grounded in industry
> benchmarks; **real-revenue basis** adopted for brokerage and contractor (and
> the structurally-identical vacation-rental *manager* case); the single
> "average agent split" question replaced by a **roster import** for brokerage
> agents and vacation-rental properties. Sources listed at the bottom.

## Problem

`createRestaurant` (`src/app/onboarding/actions.ts`) currently captures only
`name`, `businessType`, `seatCount`, `tier`, then seeds **restaurant** Profit
First accounts (`cogs_food`, `cogs_liquor`, `labor`…) and **restaurant** cost
targets (food 18%, liquor 12%, pour costs) for *all six* `BusinessType`s. Only
the module list is sector-aware. A contractor or vacation-rental operator is
asked "seat count?" and seeded with liquor COGS.

## Approach

Make the `IndustryTemplate` the single source of truth for what a sector starts
with. Add five fields:

- `scaleAnchor` — the one capacity question that replaces `seatCount`.
- `revenueBasis` — `"gross"` or `"real"` (see "Real revenue" below).
- `seedAccounts` — Profit First `VirtualAccount` rows. Non–pass-through rows sum to 100.
- `defaultTargets` — the `TargetSettings` columns that apply to the sector.
- `profileQuestions` — the sector-specific "particularly" questions.

`seedAccounts` map to the existing flexible `VirtualAccount(key, name, targetPct)`
model; `defaultTargets` map to existing `TargetSettings` columns. The only schema
addition needed is a place to store the answers — see "Storage" at the bottom.

---

## Real revenue vs. gross (methodology)

Profit First's own standard is that **materials and subcontractors are
pass-throughs**, and every other allocation is a percentage of **real revenue**
(total revenue minus those pass-throughs), not top-line. For a service business
with no materials, real revenue equals total revenue; for a contractor or a
real-estate brokerage it does not, and treating it as if it did produces
nonsense targets. ([Relay][relay], [Bennett Financials][bennett])

We apply this to the two sectors where the pass-through dominates:

- **Contractor** — `cogs_materials` and `cogs_subs` are pass-throughs; profit,
  owner pay, labor, tax, and opex are percentages of real revenue
  (revenue − materials − subs).
- **Real-estate brokerage** — `agent_splits` is the pass-through (it is most of
  every commission check); the brokerage's own buckets are percentages of
  **company dollar** (GCI − agent splits). This is the standard "company dollar"
  framing in brokerage accounting. ([AceableAgent][aceable], [The Close][close])
- **Vacation-rental *manager*** — structurally identical: `owner_payouts` and
  `platform_fees` pass through; the manager's buckets are percentages of the
  **management fee** it actually keeps. (When the operator *owns* the units this
  collapses back to a gross basis — see the VR note.)

In the data model this is expressed by `revenueBasis: "real"` on the template
plus `passThrough: true` on the pass-through `seedAccounts`. **Only the
non–pass-through rows sum to 100** (of real revenue); pass-through rows are
expressed as a percentage of gross and define what real revenue *is*.

> **Phase-2 engine implication.** The daily waterfall today computes a single
> percentage of one base. Honoring a real-revenue basis means the engine must
> first subtract pass-throughs, then allocate the remainder — another reason the
> allocation core needs generalizing (see the phase-2 caveat). Phase 1 still
> ships correct *targets*; only the daily accrual waits on phase 2.

---

## `industry-templates.ts` — proposed extension

```ts
import type { BusinessType } from "@prisma/client";

export type HeartbeatLensKey = "cash" | "discipline" | "pressure" | "momentum" | "aura";

/**
 * A Profit First seed account → a VirtualAccount row.
 * Non–pass-through rows in a sector sum to 100 (of the sector's revenueBasis).
 * Pass-through rows are a % of GROSS revenue and flow straight back out.
 */
export interface SeedAccount {
  key: string;          // VirtualAccount.key (free-form; e.g. "cogs_materials")
  name: string;         // display name
  targetPct: number;    // whole-number percent
  passThrough?: boolean; // true = % of gross, excluded from the sum-to-100
}

/** Maps to TargetSettings columns. Only set what applies to the sector. */
export interface SectorTargets {
  targetPrimeCost?: number;       // direct cost + labor, % of GROSS revenue (benchmark lens)
  targetFoodCost?: number;        // restaurant only
  targetLiquorCost?: number;      // restaurant only
  targetLaborCost?: number;       // % of revenueBasis
  targetLiquorPourPct?: number;   // restaurant only
  targetBeveragePourPct?: number; // restaurant only
}

/** The capacity anchor that replaces seatCount for non-restaurant sectors. */
export interface ScaleAnchor {
  key: string;    // profile key the answer is stored under
  label: string;  // onboarding question
  unit: string;   // seats | clients | jobs | agents | units | skus
  helper?: string;
}

export type ProfileFieldType = "text" | "number" | "select" | "boolean" | "percent" | "money";

/** A sector-specific onboarding question. Answers land in Restaurant.profile (Json). */
export interface ProfileQuestion {
  key: string;
  label: string;
  type: ProfileFieldType;
  options?: string[];                 // for select
  defaultValue?: string | number | boolean;
  helper?: string;
  required?: boolean;
}

export interface IndustryTemplate {
  key: BusinessType;
  label: string;
  description: string;
  primarySetup: string;
  lenses: HeartbeatLensKey[];
  defaultModuleKeys: string[];
  // NEW:
  scaleAnchor: ScaleAnchor;
  revenueBasis: "gross" | "real"; // "real": non-passThrough seedAccounts are % of (gross − pass-throughs)
  seedAccounts: SeedAccount[];
  defaultTargets: SectorTargets;
  profileQuestions: ProfileQuestion[];
}

export const INDUSTRY_TEMPLATES: Record<BusinessType, IndustryTemplate> = {
  RESTAURANT: {
    key: "RESTAURANT",
    label: "Restaurant / hospitality",
    description: "Prime cost, sales mix, labor, tax reserve, menu performance, and reputation signals.",
    primarySetup: "POS, bank, payroll, review platforms",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation", "go-live", "prime-cost", "cash-flow", "spending", "runway",
      "tax-vault", "sales-mix", "menu-eng", "covers-flow", "labor", "aura", "benchmarks",
    ],
    scaleAnchor: { key: "seatCount", label: "How many seats does the dining room have?", unit: "seats" },
    revenueBasis: "gross", // food/bev COGS already sit inside the daily waterfall
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 5 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 5 },
      { key: "cogs_food", name: "COGS — Food", targetPct: 18 },
      { key: "cogs_liquor", name: "COGS — Liquor", targetPct: 12 },
      { key: "labor", name: "Labor", targetPct: 32 },
      { key: "opex", name: "OpEx + Spill", targetPct: 28 },
    ],
    defaultTargets: {
      targetPrimeCost: 60, targetFoodCost: 18, targetLiquorCost: 12, targetLaborCost: 32,
      targetLiquorPourPct: 20, targetBeveragePourPct: 24,
    },
    // Prime cost ~60% (food ~28–32 / labor ~30) is the long-standing full-service benchmark.
    profileQuestions: [
      { key: "serviceModel", label: "Service model", type: "select",
        options: ["Full-service", "Quick-service / fast-casual", "Bar / nightlife", "Café / coffee", "Food truck", "Ghost kitchen"], required: true },
      { key: "liquorSalesMixPct", label: "Alcohol as a % of sales (rough)", type: "percent", defaultValue: 25,
        helper: "Used as the pour-cost denominator until the POS supplies the per-day split." },
      { key: "avgCheck", label: "Average check ($)", type: "money" },
      { key: "weeklyCovers", label: "Covers per week (rough)", type: "number" },
      { key: "collectsSalesTax", label: "Do you collect sales tax?", type: "boolean", defaultValue: true },
    ],
  },

  SERVICE: {
    key: "SERVICE",
    label: "Service business",
    description: "Cash runway, payroll load, recurring costs, job/client profitability, lead flow, and satisfaction.",
    primarySetup: "bank, accounting, payroll, CRM",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation", "go-live", "cash-flow", "spending", "category-trends",
      "recurring", "runway", "payment-watch", "benchmarks", "aura",
    ],
    scaleAnchor: { key: "activeClients", label: "About how many active clients do you serve?", unit: "clients" },
    revenueBasis: "gross", // little/no material pass-through → real revenue ≈ total revenue
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 10 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 12 },
      { key: "labor", name: "Team / Payroll", targetPct: 38 },
      { key: "cogs_direct", name: "Direct Costs (materials/subs/software)", targetPct: 8 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 7 },
      { key: "opex", name: "OpEx + Spill", targetPct: 25 },
    ],
    defaultTargets: { targetPrimeCost: 46, targetLaborCost: 38 },
    // Profit First service ranges: profit 5–10, owner's pay scales down as payroll grows, tax ~15. ([relay][relay])
    profileQuestions: [
      { key: "billingModel", label: "How do you mostly bill?", type: "select",
        options: ["Hourly", "Retainer / recurring", "Per-project / fixed-fee", "Mixed"], required: true },
      { key: "arTermsDays", label: "Typical payment terms (days)", type: "number", defaultValue: 30,
        helper: "Drives the payment-watch / receivables lens." },
      { key: "recurringRevenuePct", label: "% of revenue that is recurring", type: "percent" },
      { key: "billableUtilizationTarget", label: "Target billable utilization %", type: "percent", defaultValue: 65 },
    ],
  },

  CONTRACTOR: {
    key: "CONTRACTOR",
    label: "Contractor / field service",
    description: "Job margin, labor utilization, materials pressure, receivables, schedule capacity, and cash runway.",
    primarySetup: "bank, accounting, jobs, payroll",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation", "go-live", "cash-flow", "spending", "category-trends",
      "payment-watch", "runway", "job-margin", "recurring", "aura", "benchmarks",
    ],
    scaleAnchor: { key: "concurrentJobs", label: "How many jobs run at once, typically?", unit: "jobs" },
    revenueBasis: "real", // materials + subs pass through; the rest is % of real revenue
    seedAccounts: [
      // Pass-throughs (% of gross). Materials ~30–40% of job cost, subs ~5–10%. ([nextins][nextins])
      { key: "cogs_materials", name: "Materials", targetPct: 32, passThrough: true },
      { key: "cogs_subs", name: "Subcontractors", targetPct: 8, passThrough: true },
      // Real-revenue buckets (sum to 100 of real revenue ≈ 60% of gross):
      { key: "labor", name: "Field Labor", targetPct: 40 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 20 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 15 },
      { key: "profit", name: "Profit", targetPct: 10 },
      { key: "opex", name: "OpEx + Spill", targetPct: 15 },
    ],
    defaultTargets: { targetPrimeCost: 64, targetLaborCost: 40 },
    // Real revenue ≈ 60% of gross; field labor 40% of real ≈ 24% of gross. Prime (materials+subs+labor) ≈ 64% of gross.
    profileQuestions: [
      { key: "trade", label: "Primary trade", type: "select",
        options: ["General", "HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping", "Remodel", "Other"], required: true },
      { key: "materialsVsLaborSplit", label: "Materials as a % of job cost (rough)", type: "percent", defaultValue: 50,
        helper: "Tunes the materials/subs pass-through so real revenue is right for your trade." },
      { key: "depositPct", label: "Typical deposit collected up front (%)", type: "percent", defaultValue: 30 },
      { key: "retainagePct", label: "Retainage held on contracts (%)", type: "percent", defaultValue: 0,
        helper: "Drives receivables / AR-aging pressure." },
      { key: "crewSize", label: "Field crew headcount", type: "number" },
    ],
  },

  REAL_ESTATE_BROKERAGE: {
    key: "REAL_ESTATE_BROKERAGE",
    label: "Real estate broker / agent team",
    description: "Commission pipeline, splits, lead ROI, tax reserves, deal margin, and referral/reputation momentum.",
    primarySetup: "accounting, bank, CRM, listings, agent roster",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation", "go-live", "company-dollar", "cash-flow", "spending", "category-trends",
      "payment-watch", "runway", "commission-pipeline", "agent-performance", "agent-roster",
      "market-intelligence", "lead-roi", "recurring", "aura", "benchmarks",
    ],
    scaleAnchor: { key: "agentCount", label: "How many agents are on the team?", unit: "agents",
      helper: "Set automatically when you import the agent roster." },
    revenueBasis: "real", // agent splits pass through; brokerage buckets are % of company dollar
    seedAccounts: [
      // Pass-through (% of gross GCI). DEFAULT blended split; overwritten per-agent by the
      // imported roster. Seasoned producers keep 80–90%+, new agents 50–70%, so a real
      // roster usually lands the blended payout around 70–80%. ([aceable][aceable], [close][close])
      { key: "agent_splits", name: "Agent Commission Splits", targetPct: 73, passThrough: true },
      // Company-dollar buckets (sum to 100 of company dollar ≈ 27% of GCI):
      { key: "owner_pay", name: "Owner Pay", targetPct: 22 },
      { key: "labor", name: "Staff Payroll", targetPct: 20 },
      { key: "lead_marketing", name: "Lead Gen / Marketing", targetPct: 18 },
      { key: "profit", name: "Profit", targetPct: 15 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 15 },
      { key: "opex", name: "OpEx + Spill", targetPct: 10 },
    ],
    defaultTargets: { targetPrimeCost: 73, targetLaborCost: 20 },
    // "Prime" here = agent splits (the dominant cost). Company dollar ≈ 27% of GCI; profit 15% of
    // company dollar ≈ 4% of GCI. The roster import refines the 73% blended split to the real number.
    profileQuestions: [
      // NOTE: the single "average agent split" question is GONE — the roster import (below)
      // carries each agent's real split, and the blended pass-through is derived from it.
      { key: "monthlyLeadSpend", label: "Monthly lead-gen spend ($)", type: "money",
        helper: "Drives lead-ROI." },
      { key: "capModel", label: "Do agents have an annual cap?", type: "boolean", defaultValue: false,
        helper: "Cap/100% models (e.g. KW, eXp) change company dollar late in each agent's year." },
    ],
  },

  VACATION_RENTAL: {
    key: "VACATION_RENTAL",
    label: "Vacation rental / property services",
    description: "Occupancy, booking pace, owner payouts, turn costs, platform fees, maintenance drag, and guest Aura.",
    primarySetup: "bank, booking/PMS, accounting, reviews, property roster",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation", "go-live", "cash-flow", "spending", "category-trends",
      "payment-watch", "runway", "property-heartbeat", "property-roster", "occupancy", "property-profit",
      "recurring", "aura", "benchmarks",
    ],
    scaleAnchor: { key: "unitCount", label: "How many units / properties do you operate?", unit: "units",
      helper: "Set automatically when you import the property roster." },
    revenueBasis: "real", // MANAGER model: payouts + platform fees pass through; buckets are % of the management fee
    // NOTE: defaults below are the MANAGER model (manage for owners). If the operator OWNS the
    // units (ownershipModel = "owned"), drop owner_payouts, set revenueBasis "gross", and
    // redistribute into profit/opex — branch on the profile answer at seed time.
    seedAccounts: [
      // Pass-throughs (% of gross booking revenue). Mgmt fee 20–35% of gross is the standard
      // full-service range; OTA/platform 3–15%. ([awning][awning], [skyrun][skyrun])
      { key: "owner_payouts", name: "Owner Payouts", targetPct: 70, passThrough: true },
      { key: "platform_fees", name: "Platform Fees", targetPct: 5, passThrough: true },
      // Management-fee buckets (sum to 100 of the fee ≈ 25% of gross):
      { key: "labor", name: "Ops / Turnover Coordination", targetPct: 25 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 25 },
      { key: "opex", name: "OpEx + Spill (cleaning coord., software)", targetPct: 20 },
      { key: "profit", name: "Profit", targetPct: 15 },
      { key: "tax_reserve", name: "Tax / Lodging Tax Reserve", targetPct: 15 },
    ],
    defaultTargets: { targetPrimeCost: 75, targetLaborCost: 25 },
    // Cleaning is typically passed to guests as a separate line, so it sits in opex/coordination
    // rather than as its own pass-through. mgmtFeePct (below) tunes how much of gross is real revenue.
    profileQuestions: [
      { key: "ownershipModel", label: "Do you own the units or manage for owners?", type: "select",
        options: ["Manage for owners", "Own the units", "Mixed"], required: true,
        helper: "Flips whether Owner Payouts is a pass-through (manager) or the revenue is yours (owner)." },
      { key: "mgmtFeePct", label: "Management fee (% of booking revenue)", type: "percent", defaultValue: 20,
        helper: "Sets how much of gross is your real revenue (manager model)." },
      { key: "platformMix", label: "Main booking channel", type: "select",
        options: ["Airbnb", "VRBO", "Booking.com", "Direct", "Mixed"] },
      { key: "targetOccupancyPct", label: "Target occupancy %", type: "percent", defaultValue: 65 },
    ],
  },

  RETAIL: {
    key: "RETAIL",
    label: "Retail",
    description: "Gross margin, cash runway, inventory pressure, returns, sell-through, traffic, and reviews.",
    primarySetup: "POS, bank, inventory, ecommerce/reviews",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation", "go-live", "cash-flow", "spending", "category-trends",
      "recurring", "runway", "inventory", "aura", "benchmarks",
    ],
    scaleAnchor: { key: "skuCount", label: "Roughly how many SKUs (or departments)?", unit: "skus" },
    revenueBasis: "gross",
    seedAccounts: [
      { key: "cogs_inventory", name: "COGS — Inventory", targetPct: 55 },
      { key: "labor", name: "Labor", targetPct: 18 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 7 },
      { key: "profit", name: "Profit", targetPct: 5 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 5 },
      { key: "opex", name: "OpEx + Spill", targetPct: 10 },
    ],
    defaultTargets: { targetPrimeCost: 73, targetLaborCost: 18 },
    // COGS 55 → ~45% gross margin (SMB specialty retail; general-retail avg gross margin runs
    // lower, ~31%, dragged by grocery/big-box). Retail labor 15–25% of sales. ([crestmont][crestmont])
    profileQuestions: [
      { key: "storefrontType", label: "Storefront type", type: "select",
        options: ["Brick-and-mortar", "E-commerce", "Both"], required: true },
      { key: "targetGrossMarginPct", label: "Target gross margin %", type: "percent", defaultValue: 45 },
      { key: "onlineSalesMixPct", label: "% of sales online", type: "percent" },
      { key: "returnRatePct", label: "Typical return rate %", type: "percent", defaultValue: 5 },
      { key: "inventoryMethod", label: "Inventory valuation", type: "select", options: ["FIFO", "Weighted average", "Not tracked"] },
    ],
  },
};

export function industryTemplateFor(type: BusinessType | null | undefined): IndustryTemplate {
  return INDUSTRY_TEMPLATES[type ?? "RESTAURANT"] ?? INDUSTRY_TEMPLATES.RESTAURANT;
}
```

---

## Roster import — agents (brokerage) and properties (vacation rental)

The sectors with multiple sub-entities don't fit a "type a number" onboarding
question. A broker has a *roster of agents*, each on a different split; a manager
has a *portfolio of properties*, each with its own occupancy and payout. The
broker is going to enter those anyway, so onboarding should let them **import the
whole roster in one step** — and those same rows become the entities the
red/amber/green morning view triages (see the design-copy spec, "RAG roster").

### Why import beats asking

- **Accuracy.** The blended `agent_splits` pass-through (default 73%) is *derived*
  from real per-agent splits instead of guessed — seasoned producers (80–90%+)
  and new agents (50–70%) blend to the brokerage's true company dollar.
- **No double entry.** Brokers already keep this in their back-office / CRM
  software; managers keep it in a PMS. We accept their export, not retype.
- **It seeds the roster modules.** `agent-roster` / `agent-performance` and
  `property-roster` / `property-heartbeat` light up immediately.

### Accepted inputs (lowest-friction first)

1. **Direct software export (recommended).** A CSV/XLSX exported from common
   tools, mapped by a per-source column profile:
   - *Brokerage back-office / CRM:* Brokermint, Sisu, Lone Wolf (brokerWOLF),
     BoldTrail / kvCORE, KW Command, Follow Up Boss, Dotloop, SkySlope.
   - *Vacation-rental PMS:* Guesty, Hostaway, OwnerRez, Lodgify, Hostfully,
     Track, Escapia.
2. **Generic spreadsheet.** A plain Excel/CSV with a column mapper UI (drag a
   column → a field). Always available as the fallback.
3. **Manual add.** Add a few rows by hand for tiny teams or a quick start.

### Minimal import schema

```ts
// Brokerage — one row per agent
export interface AgentRosterRow {
  name: string;
  email?: string;
  splitPctAgent: number;     // agent's share of GCI (company dollar = 100 − this)
  capModel?: boolean;
  capAmount?: number;
  ytdGci?: number;           // gross commission income YTD ($)
  unitsClosed?: number;      // YTD
  pipelineCount?: number;    // active/under-contract
  startDate?: string;        // tenure → seasoned vs new
  status?: "active" | "inactive";
}

// Vacation rental — one row per property/unit
export interface PropertyRosterRow {
  name: string;              // unit / listing name
  owner?: string;
  mgmtFeePct?: number;       // overrides the sector default for this unit
  adr?: number;              // average daily rate ($)
  occupancyPct?: number;     // trailing occupancy
  platform?: string;         // Airbnb | VRBO | Direct | …
  cleaningFee?: number;
  status?: "active" | "inactive";
}
```

The blended brokerage `agent_splits` pass-through is then
`weightedAverage(splitPctAgent, by ytdGci)` — GCI-weighted so the producers who
actually move company dollar dominate the blend (your "the seasoned crew matters
more than an exact newbie count" point, made precise). Until a roster is
imported, the 73% default stands.

### Storage

A `RosterEntity` model (1:many from `Restaurant`) is the typed home for both —
`kind: "AGENT" | "PROPERTY"`, the shared fields above in real columns plus a
`metrics Json` for sector extras. This is the table the RAG view reads. (If we
want to ship faster, the rows can start life inside `Restaurant.profile` JSON and
graduate to a model when the RAG view is built — but the roster is the thing the
triage view depends on, so a real model is the better first move here.)

---

## Onboarding refactor — proposed `createRestaurant`

Consume the template instead of hardcoding restaurant accounts/targets:

```ts
export interface OnboardingInput {
  name: string;
  businessType: BusinessType;
  tier: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4";
  scaleValue?: number;                 // the answer to template.scaleAnchor
  profile?: Record<string, unknown>;   // answers to template.profileQuestions
  roster?: AgentRosterRow[] | PropertyRosterRow[]; // optional, sectors with sub-entities
}

export async function createRestaurant(input: OnboardingInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const template = industryTemplateFor(input.businessType);
  const t = template.defaultTargets;

  // Real-revenue sectors: pass-through rows seed as-is; non–pass-through rows are the
  // 100-sum allocation. Brokerage agent_splits is overwritten by the GCI-weighted roster blend.
  const seedAccounts = applyRosterToSeeds(template, input.roster);

  await prisma.restaurant.create({
    data: {
      name: input.name,
      slug: slugify(input.name),
      businessType: template.key,
      // seatCount stays for restaurants; generic anchor goes in profile (see Storage)
      seatCount: template.scaleAnchor.key === "seatCount" ? (input.scaleValue ?? null) : null,
      profile: {
        ...(input.profile ?? {}),
        [template.scaleAnchor.key]: input.scaleValue ?? rosterCount(input.roster) ?? null,
      },
      userRoles: { create: { clerkUserId: userId, role: "OPERATOR" } },
      tapSettings: { create: {} }, // legacy restaurant columns keep schema defaults
      targetSettings: {
        create: {
          targetPrimeCost: t.targetPrimeCost ?? null,
          targetFoodCost: t.targetFoodCost ?? null,
          targetLiquorCost: t.targetLiquorCost ?? null,
          targetLaborCost: t.targetLaborCost ?? null,
          targetLiquorPourPct: t.targetLiquorPourPct ?? null,
          targetBeveragePourPct: t.targetBeveragePourPct ?? null,
        },
      },
      moduleConfigs: {
        create: template.defaultModuleKeys.map((moduleKey, i) => ({ moduleKey, position: i })),
      },
      virtualAccounts: {
        create: seedAccounts.map((a) => ({ key: a.key, name: a.name, targetPct: a.targetPct })),
      },
      rosterEntities: input.roster?.length
        ? { create: input.roster.map((r) => toRosterEntity(template.key, r)) }
        : undefined,
    },
  });

  redirect(input.tier === "TIER_3" ? "/import" : "/dashboard");
}
```

---

## Caveat: the allocation engine is still restaurant-shaped (phase 2)

`VirtualAccount` is flexible (`key`/`name`/`targetPct`), but the **daily Profit
First waterfall is not**. Confirmed in code:

- `TapSettings` has six fixed columns: `profitPct`, `ownerPayPct`, `cogsFoodPct`,
  `cogsLiquorPct`, `laborPct`, `opexPct`.
- `src/lib/profit-first/calculator.ts` + `allocation.ts` read those columns and
  emit a fixed `byBucket` shape (`cogsFood`, `cogsLiquor`, `labor`, `opex`, …).
- `BucketAllocation` (the auditable daily ledger) stores those same fixed columns.

So `seedAccounts` give each sector the correct **account identities and target
percentages** — enough for the allocation tile's target lines, onboarding, the
module list, and any module that doesn't read the daily TAP ledger. But the
actual daily accrual would still compute *restaurant* buckets for everyone. A
contractor's `cogs_materials` / `agent_splits` VirtualAccount would show a target
but never get funded by the waterfall.

Treat this as two phases:

- **Phase 1 (this proposal):** sector-correct VirtualAccounts, targets, modules,
  profile questions, and roster import. Ship-able on its own; fixes the "asked
  seat count, seeded liquor COGS" problem and powers targets/benchmarks/roster.
- **Phase 2 (financial core, larger lift):** generalize the engine so allocation
  is **keyed by `VirtualAccount.key`** instead of the six hardcoded columns, and
  honors `revenueBasis` (subtract pass-throughs, then allocate the remainder) —
  `TapSettings` → per-bucket rows/JSON, `BucketAllocation` → keyed amounts, and
  `calculator.ts`/`allocation.ts` → bucket-agnostic. Must keep restaurant output
  byte-for-byte identical (extend `calculator.test.ts` first) since this touches
  money math under the AGENTS.md "financial logic stays covered by Vitest" rule.
  **Tracked as a separate issue, not part of this docs PR.**

## Storage (the one schema change for seeds)

Sector profile answers (the `scaleAnchor` value + `profileQuestions`) need a home.
Lowest-risk option — a single nullable JSON column on `Restaurant`:

```prisma
model Restaurant {
  // ...existing...
  profile Json? // sector onboarding answers: scale anchor + profileQuestions
}
```

Additive and nullable, so it's a safe migration — but per repo guardrails, a
production migration is an operator action. Apply via the normal review flow; do
not run `prisma migrate deploy` against prod from here. The roster (`RosterEntity`)
is a second additive model — see "Roster import → Storage" above.

Alternative if you'd rather keep it typed/queryable: a `BusinessProfile` model
(1:1 with `Restaurant`) with real columns. JSON is faster to ship; a model is
better if these fields start driving calculations.

## Validation invariants worth a test

- For every sector, the **non–pass-through** `seedAccounts` sum to **100**
  (add to `industry-templates.test.ts`).
- `revenueBasis: "real"` sectors have at least one `passThrough` account; `"gross"`
  sectors have none.
- Every `defaultModuleKeys` entry exists in `MODULES`.
- `profileQuestions[].key` values are unique per sector.
- Roster column-mapper profiles map onto `AgentRosterRow` / `PropertyRosterRow`.

## Sources

- [Profit First percentages by business type — Relay][relay]
- [Profit First target percentages by revenue — Bennett Financials][bennett]
- [How real-estate commission splits work — AceableAgent][aceable]
- [Real-estate commission splits — The Close][close]
- [Typical contractor overhead & profit margin — NEXT Insurance][nextins]
- [Airbnb / STR management fees breakdown — Awning][awning]
- [Vacation-rental management fees & costs — SkyRun][skyrun]
- [Profit-margin benchmarks by industry — Crestmont Capital][crestmont]

[relay]: https://relayfi.com/blog/profit-first-percentages/
[bennett]: https://bennettfinancials.com/profit-first-taps-allocations-ch5/
[aceable]: https://www.aceableagent.com/blog/how-does-commission-split-work-real-estate-agents/
[close]: https://theclose.com/real-estate-commission-splits/
[nextins]: https://www.nextinsurance.com/blog/typical-contractor-overhead-profit-margin/
[awning]: https://awning.com/post/airbnb-management-fees
[skyrun]: https://skyrun.com/blog/understanding-vacation-rental-management-fees-and-costs/
[crestmont]: https://www.crestmontcapital.com/blog/profit-margin-benchmarks-by-industry
