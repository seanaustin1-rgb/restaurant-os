# Spec C — Industry Manifest System (One Engine, Many Views)

**Repo:** seanaustin1-rgb/restaurant-os · **Format:** Claude Code handoff, same style as Spec A/B in PRODUCT-MAP.md
**Prereq:** merge `claude/rule-guardrails-and-triage` first (CLAUDE.md auto-load is stranded on it)
**Goal:** Adding an industry = one manifest file + one rule seed pack. No schema change, no engine touch, no fork. Industry layer contains **zero arithmetic**.

---

## Non-negotiables (paste into CLAUDE.md when done)

1. Engine code queries **bucket keys and category keys only** — never labels. Labels come from the manifest.
2. Manifests contain no math. New vertical arithmetic = new shared, capability-gated module.
3. Every manifest is snapshot-tested; bucket defaultPcts must sum to 100; every module in `enable` must have its `requires` satisfiable by the manifest's declared source capabilities (or render with a derived blocker).
4. Rule seed patterns must pass `keywordPatternProblem` in `src/lib/categorization/suggestions.ts`. No generic/short keywords, ever, including seeds.

---

## Step 1 — Types

`src/lib/industries/types.ts`

```ts
// STABLE across all industries. Engine queries these. Never add per-vertical keys.
export const BUCKET_KEYS = [
  'PROFIT', 'OWNER_PAY', 'TAX', 'DIRECT_COST', 'LABOR', 'OPEX', 'SPILL',
] as const;
export type BucketKey = (typeof BUCKET_KEYS)[number];

// What a data source proves the tenant has. Modules gate on these.
export const CAPABILITIES = [
  'BANK_TXNS',            // Plaid or statement import
  'LEDGER',               // clean-ledger spine populated
  'EARNED_SALES',         // Toast (or future POS) — allocation basis
  'SALES_MIX',            // Toast menu items
  'COMMISSION_PIPELINE',  // brokerage CSV: pending closings w/ dates
  'BOOKING_CALENDAR',     // rental PMS/CSV: future nights + payouts
  'PER_UNIT_PNL',         // property/job-level cost attribution
  'REPUTATION',           // Places/Yelp/Meta/GBP keys present
  'RECURRING_DETECTED',   // Recurring module has ≥1 confirmed series
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface BucketConfig {
  key: BucketKey;
  label: string;            // display only
  defaultPct: number;       // onboarding default; TapSettings still owns live pcts
  earmarked?: boolean;      // renders as "not your money" (Tax Vault, Owner Payouts)
}

export interface SourceConfig {
  id: 'PLAID' | 'TOAST' | 'STATEMENT_PDF' | 'CSV_BROKERAGE' | 'CSV_RENTAL' | 'GBP' | 'AURA';
  provides: Capability[];
  showOnSourcesHub: boolean; // controls connect cards on /settings/sources
  onboardingStep: boolean;   // appears in owner checklist? (Aura/GBP: false, per Chunk 5)
}

export interface ModuleOverride {
  id: string;                // must exist in src/lib/modules.ts
  label?: string;            // display rename
}

export interface SignalVocab {
  revenueNoun: string;       // "sales" | "GCI" | "gross rents" | "billings"
  unitNoun: string;          // "cover" | "closing" | "night" | "job"
  unitNounPlural: string;
  paceTemplate: string;      // e.g. "{revenueNoun} pace vs 4-week baseline"
}

export interface IndustryManifest {
  id: string;                // MUST match businessType enum value exactly
  displayName: string;
  nouns: { tenant: string; revenue: string; unit: string; directCost: string };
  buckets: BucketConfig[];   // exactly the 7 keys, once each
  sources: SourceConfig[];
  modules: { enable: string[]; overrides: ModuleOverride[] };
  ruleSeedPack: RuleSeed[];  // see Step 6
  benchmarks: 'RESTAURANT_STATIC' | null;  // null = hidden (Chunk 5 decision)
  signalVocab: SignalVocab;
}

export interface RuleSeed {
  pattern: string;
  matchType: 'KEYWORD';
  direction: 'INFLOW' | 'OUTFLOW';
  categoryKey: string;       // canonical category key, not label
  note?: string;             // shows in rule list: why this seed exists
}
```

## Step 2 — Restaurant manifest (the regression proof)

`src/lib/industries/restaurant.manifest.ts`

Extract every currently-hardcoded restaurant label into this file. This is the bulk of the work and the proof the abstraction holds. Where to hunt:
- `src/lib/modules.ts` — tile titles/descriptions
- Dashboard components rendering "Sales", "COGS", "Prime Cost", "covers"
- Onboarding starter cards + owner checklist copy
- signals.ts message templates (extract nouns only — thresholds/logic stay put)
- TapSettings onboarding defaults (5/5/30/27/20/13 → `defaultPct`s here)

Buckets: PROFIT 5, OWNER_PAY 5, TAX 30 *(verify — current split has TAX inside the 30? map to whatever TapSettings seeds today; do not change live math)*, DIRECT_COST "COGS" 30, LABOR 27, OPEX 20, SPILL 13 — **copy the exact current seed values, sum-to-100 test will catch drift.** TAX gets `earmarked: true`.

**Acceptance for this step: Stone Grille renders pixel/text-identical before and after.** Add a smoke test that snapshots key dashboard strings for a restaurant tenant pre/post.

## Step 3 — Brokerage + rental manifests, stubs for the rest

- `brokerage.manifest.ts` — nouns: Brokerage / GCI / closing / Agent Splits. Buckets: PROFIT 5, OWNER_PAY 10, TAX 15, DIRECT_COST "Agent Splits" 55, LABOR "Staff & Admin" 5, OPEX 8, SPILL 2. Sources: PLAID, CSV_BROKERAGE, STATEMENT_PDF. Modules: CASH_OXYGEN, ALLOCATION ("Every Dollar Named"), FORWARD_CASH, COMPANY_DOLLAR, COMMISSION_PIPELINE, AGENT_PERFORMANCE, LEAD_ROI. benchmarks: null.
- `rental.manifest.ts` — nouns: Portfolio / Gross Rents / night / Owner Payouts. Buckets: DIRECT_COST relabeled **"Owner Payouts"** with `earmarked: true` (trust-money separation — this is the investor feature), defaults PROFIT 5, OWNER_PAY 8, TAX 12, DIRECT_COST 60, LABOR 5, OPEX 8, SPILL 2. Sources: PLAID, CSV_RENTAL, STATEMENT_PDF. Modules: CASH_OXYGEN, ALLOCATION, FORWARD_CASH, PROPERTY_COCKPIT, PAYMENT_WATCH.
- `service/retail/contractor/winery` — stub manifests: restaurant-shaped defaults, minimal module set, empty seed packs. Existence keeps the registry total and the tests honest.

Winery note (new vertical named in the task): stub it as `WINERY` with DIRECT_COST label "Production & Fruit", unit "case". Real build waits — but the stub proves add-a-vertical-in-one-file on day one.

## Step 4 — Registry + accessor

`src/lib/industries/index.ts`

```ts
import { restaurant } from './restaurant.manifest';
// ...all manifests

const REGISTRY: Record<string, IndustryManifest> = Object.fromEntries(
  [restaurant, brokerage, rental, service, retail, contractor, winery].map(m => [m.id, m]),
);

export function getManifest(businessType: string): IndustryManifest {
  return REGISTRY[businessType] ?? restaurant; // legacy tenants predate enum hygiene
}
```

Server components call `getManifest(restaurant.businessType)`; client side gets it via a `IndustryProvider` context hydrated in the tenant layout. One provider, no per-component fetching.

## Step 5 — Wire modules.ts + derived blockers

- Dashboard renders `manifest.modules.enable ∩ modules.ts`, applying label overrides.
- Kill hardcoded "soon" blocker strings for gated modules: blocker text derives from unmet `requires`. `FORWARD_CASH.requires = ['BANK_TXNS','RECURRING_DETECTED']` → a CSV-only brokerage with no recurring series confirmed shows "Confirm one recurring bill to unlock" automatically. (Also fixes the wrong "More history" blocker flagged in Chunk 5 #2.)
- Non-enabled modules don't render at all — no restaurant tiles on a brokerage tenant, and "soon" tiles move to the Roadmap page per Chunk 5.

## Step 6 — Rule seed packs

- On tenant creation (and via a backfill script for existing tenants), insert `ruleSeedPack` rows as `Rule` records tagged `source: 'SEED'`, editable/deletable like any manual rule.
- Every seed pattern is validated through `keywordPatternProblem` **in a unit test at build time** — a bad seed fails CI, not a customer.
- Seed packs live next to the manifest: `src/lib/industries/seeds/brokerage.seeds.ts` (content in the seed-pack deliverable, this session).
- Stone's rule history is the restaurant seed pack: script `scripts/export-rules-as-seeds.ts [slug]` dumps a tenant's confirmed rules in RuleSeed format for curation. Don't auto-ship raw — curate for generality first.

## Step 7 — TAP defaults + earmarked rendering

- Onboarding TapSettings creation reads `manifest.buckets` for labels + defaultPcts. **Existing tenants untouched** — manifest defaults apply at creation only; live pcts stay in TapSettings.
- If TapSettings/VirtualAccount lacks a display-label column: **do not add one.** Labels resolve at render time from manifest by bucket key. (Check whether VirtualAccount stores freeform names today — if yes, migration writes manifest labels once for new tenants and leaves existing names alone.)
- `earmarked: true` buckets render in the "not your money" visual state (Tax Vault pattern) — this delivers the Owner Payout Vault with zero new engine code.

## Step 8 — Signals vocab

signals.ts message construction takes `signalVocab` for nouns only. Thresholds, ranking, Top-3 cap, evidence format: untouched. Grep for hardcoded "sales"/"covers" in signal templates.

## Step 9 — Tests

- Snapshot every manifest.
- Invariants: 7 bucket keys exactly once; pcts sum to 100; module IDs exist in modules.ts; every seed passes keywordPatternProblem; every enabled module's `requires` ⊆ union of declared source capabilities.
- Restaurant regression: Stone dashboard strings identical pre/post (Step 2 acceptance).
- One integration test: create a BROKERAGE tenant → assert seeded rules exist, brokerage labels render, restaurant modules absent.

---

## Order of execution
1 → 2 (biggest step, ship alone as its own PR) → 4 → 5 → 3 → 6 → 7 → 8 → 9 throughout. Steps 3–8 can be one PR.

## Explicitly out of scope
- Spec A/B (ledger convergence, Toast multi-tenancy) — unchanged, still ahead of this in priority order **except**: Steps 3+7 (brokerage/rental manifests + earmarked rendering) pull forward for the investor meeting since they're label-layer only.
- Per-tenant custom bucket labels (operator renames) — later; manifest is the only label source for now.
- Winery/contractor real content.
