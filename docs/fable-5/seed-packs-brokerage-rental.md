# Rule Seed Packs — Brokerage + Vacation Rental

Format matches `RuleSeed` from Spec C Step 1. Every pattern is multi-word or a distinctive brand name — built to pass `keywordPatternProblem` (no generic single words, no short tokens). CI test validates all seeds against the guardrail before ship.

Category keys are canonical (engine-side); manifests label them. Where I've guessed a key name, match to your existing Category taxonomy — the key column is the thing to verify against `src/lib/categorization/rules.ts`, not the pattern column.

**Coverage philosophy:** seeds catch the *national/franchise* vendors every tenant has. Local vendors (title companies, cleaners) surface as exceptions in week one and become tenant rules — that's the exception-review flow working as designed, not a gap. Tell the customer that in onboarding: "first week names your local vendors, then it's quiet."

---

## brokerage.seeds.ts

```ts
export const brokerageSeeds: RuleSeed[] = [
  // ── INFLOWS ──────────────────────────────────────────────
  // Commission wires come from local title cos — can't seed names nationally.
  // These catch the platforms that ARE consistent:
  { pattern: 'dotloop payout',        matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'COMMISSION_INCOME', note: 'Dotloop commission disbursement' },
  { pattern: 'skyslope',              matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'COMMISSION_INCOME', note: 'SkySlope transaction platform' },
  { pattern: 'earnest money',         matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'ESCROW_HELD',       note: 'Not revenue — held funds. Earmarked.' },

  // ── AGENT SPLITS / DIRECT_COST ───────────────────────────
  { pattern: 'commission split',      matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'AGENT_SPLIT' },
  { pattern: 'agent commission',      matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'AGENT_SPLIT' },
  { pattern: 'referral fee',          matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'AGENT_SPLIT',       note: 'Outbound referral to other brokerage' },

  // ── MLS / ASSOCIATION / LICENSING ────────────────────────
  { pattern: 'bright mls',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MLS_DUES',          note: 'PA/mid-Atlantic MLS' },
  { pattern: 'mls dues',              matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MLS_DUES' },
  { pattern: 'national association of realtors', matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'ASSOC_DUES' },
  { pattern: 'realtors association',  matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'ASSOC_DUES',        note: 'Catches state/local boards' },
  { pattern: 'supra ekey',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MLS_DUES',          note: 'Lockbox system' },
  { pattern: 'sentrilock',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MLS_DUES' },
  { pattern: 'real estate commission', matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LICENSING',        note: 'State license renewals (PA REC etc.)' },

  // ── FRANCHISE ────────────────────────────────────────────
  { pattern: 'keller williams',       matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'FRANCHISE_FEE' },
  { pattern: 'remax llc',             matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'FRANCHISE_FEE' },
  { pattern: 'coldwell banker',       matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'FRANCHISE_FEE' },
  { pattern: 'exp realty',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'FRANCHISE_FEE' },
  { pattern: 'berkshire hathaway homeservices', matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'FRANCHISE_FEE' },

  // ── LEAD GEN / MARKETING ─────────────────────────────────
  { pattern: 'zillow group',          matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LEAD_GEN',          note: 'Feeds Lead ROI module' },
  { pattern: 'realtor.com',           matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LEAD_GEN' },
  { pattern: 'opcity',                matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LEAD_GEN' },
  { pattern: 'homes.com',             matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LEAD_GEN' },
  { pattern: 'follow up boss',        matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'kvcore',                matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'boomtown',              matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },

  // ── TRANSACTION TOOLS / SOFTWARE ─────────────────────────
  { pattern: 'docusign',              matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'dotloop',               matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE',          note: 'Direction disambiguates vs payout inflow' },
  { pattern: 'showingtime',           matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'transaction desk',      matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },

  // ── INSURANCE / PROFESSIONAL ─────────────────────────────
  { pattern: 'errors and omissions',  matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'INSURANCE' },
  { pattern: 'e&o insurance',         matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'INSURANCE' },

  // ── LISTING COSTS ────────────────────────────────────────
  { pattern: 'real estate photography', matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LISTING_COSTS' },
  { pattern: 'matterport',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LISTING_COSTS',     note: '3D tours' },
  { pattern: 'home warranty',         matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LISTING_COSTS',     note: 'Often seller concession paid by brokerage' },
  { pattern: 'staging',               matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LISTING_COSTS' },   // verify length passes guardrail; if not: 'home staging'
];
```

## rental.seeds.ts

```ts
export const rentalSeeds: RuleSeed[] = [
  // ── INFLOWS (platform payouts = gross rents) ─────────────
  { pattern: 'airbnb payments',       matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'BOOKING_REVENUE',   note: 'Airbnb payout descriptor' },
  { pattern: 'vrbo payout',           matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'BOOKING_REVENUE' },
  { pattern: 'homeaway',              matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'BOOKING_REVENUE',   note: 'Legacy VRBO descriptor still appears' },
  { pattern: 'booking.com',           matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'BOOKING_REVENUE' },
  { pattern: 'guest damage',          matchType: 'KEYWORD', direction: 'INFLOW',  categoryKey: 'DAMAGE_RECOVERY',   note: 'Not revenue — offsets repair cost' },

  // ── OWNER PAYOUTS (earmarked — the trust-money bucket) ───
  { pattern: 'owner payout',          matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'OWNER_PAYOUT' },
  { pattern: 'owner distribution',    matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'OWNER_PAYOUT' },
  { pattern: 'owner draw',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'OWNER_PAYOUT',      note: 'Watch collision w/ OWNER_PAY bucket for self-owned units — review flags it' },

  // ── TURNOVER / DIRECT ────────────────────────────────────
  { pattern: 'cleaning service',      matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'TURNOVER_COST' },
  { pattern: 'turnover clean',        matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'TURNOVER_COST' },
  { pattern: 'linen service',         matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'TURNOVER_COST' },
  { pattern: 'turnify',               matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'TURNOVER_COST',     note: 'Turnover mgmt platform' },
  { pattern: 'breezeway',             matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'TURNOVER_COST' },

  // ── SOFTWARE / PMS / PRICING ─────────────────────────────
  { pattern: 'guesty',                matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'hostaway',              matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'ownerrez',              matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'hospitable',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'lodgify',               matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'pricelabs',             matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE',          note: 'Dynamic pricing' },
  { pattern: 'wheelhouse pricing',    matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },
  { pattern: 'beyond pricing',        matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'SOFTWARE' },

  // ── GUEST-FACING SERVICES ────────────────────────────────
  { pattern: 'schlage',               matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'PROPERTY_SUPPLIES', note: 'Smart locks' },
  { pattern: 'ring subscription',     matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'PROPERTY_SUPPLIES' },
  { pattern: 'noiseaware',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'PROPERTY_SUPPLIES' },
  { pattern: 'hot tub service',       matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MAINTENANCE' },
  { pattern: 'pool service',          matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MAINTENANCE' },
  { pattern: 'lawn care',             matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MAINTENANCE' },
  { pattern: 'pest control',          matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'MAINTENANCE' },

  // ── TAX / COMPLIANCE ─────────────────────────────────────
  { pattern: 'lodging tax',           matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'OCCUPANCY_TAX',     note: 'Earmarked — Tax Vault pattern' },
  { pattern: 'occupancy tax',         matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'OCCUPANCY_TAX' },
  { pattern: 'hotel tax',             matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'OCCUPANCY_TAX' },
  { pattern: 'str permit',            matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LICENSING' },
  { pattern: 'short term rental permit', matchType: 'KEYWORD', direction: 'OUTFLOW', categoryKey: 'LICENSING' },
];
```

---

## Known ambiguities — leave to exception review, do NOT seed

- **Utilities** (electric/water/gas per property) — descriptors are local utility names; can't seed nationally. Per-property attribution needs the Property Cockpit mapping anyway.
- **Amazon / Home Depot / Lowe's** — could be supplies, could be capex, could be personal. Seeding these creates the June-labor-bug class of miscategorization. Exceptions with the rule engine's guess is the correct behavior.
- **"Airbnb" bare** — appears in both payouts (inflow) and guest-refund debits (outflow). Seeded the inflow descriptor specifically; outflows land in review.
- **Owner payouts to self** for a manager who also owns units — collision between OWNER_PAYOUT (trust) and OWNER_PAY (Profit First bucket). Flag in onboarding checklist: "Do you own any units you manage?"

## Category keys to verify/create in the taxonomy
Brokerage: COMMISSION_INCOME, ESCROW_HELD (earmarked), AGENT_SPLIT, MLS_DUES, ASSOC_DUES, FRANCHISE_FEE, LEAD_GEN, LISTING_COSTS, LICENSING.
Rental: BOOKING_REVENUE, DAMAGE_RECOVERY, OWNER_PAYOUT (earmarked), TURNOVER_COST, MAINTENANCE, PROPERTY_SUPPLIES, OCCUPANCY_TAX (earmarked), LICENSING.
Shared/existing: SOFTWARE, INSURANCE map to whatever keys restaurants already use.

Bucket mapping (TapBucket): AGENT_SPLIT + OWNER_PAYOUT + TURNOVER_COST → DIRECT_COST. OCCUPANCY_TAX + ESCROW_HELD → TAX-style earmarked handling. LEAD_GEN + LISTING_COSTS + SOFTWARE + MAINTENANCE → OPEX. Everything flows through the same waterfall.
