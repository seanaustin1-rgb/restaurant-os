# Spirit Vault Flight Builder - ASAP Build Plan

Status: build plan for Claude + Codex coordination
Target: workable Flight Builder by Friday, 2026-08-21
Primary rule: ship a reliable curated builder first; enrich the intelligence layer after launch.

## Product Goal

Give staff a fast way to create a polished tasting flight from the hosted
Restaurant OS Spirit Vault:

1. Pick a flight template.
2. Review eligible live pours scoped to the current `restaurantId`.
3. Select up to 4 pours.
4. Apply the template through-line and per-slot notes.
5. Generate the existing guest placemat / prep sheet.

This is not guest-generated custom flight creation. Flights remain staff-curated,
prebuilt, and Toast-trackable.

## Launch Definition

The end-of-week MVP is complete when a staff user can:

- Open the admin Flight Builder.
- Choose at least `Proof Ascender` and `High Proof`.
- See eligible candidate pours from the current tenant only.
- Select 2-4 pours.
- Save the flight as `DRAFT`.
- Generate a placemat/prep sheet from the saved flight.
- Publish only after staff review.

Do not block launch on guest ratings, owner-wide reports, distillery uploads,
or perfect metadata normalization.

## Hard Technical Constraints

- Hosted `restaurant-os` Vault is the secure membership/access layer.
- Stone website is only link/QR entry.
- Every query and write is scoped by `restaurantId`.
- No Stone-only assumptions in shared models, templates, or routes.
- Candidate pours must come from canonical Spirit Vault models:
  `SpiritDefinition`, `VenueSpirit`, `SpiritPour`, and `SpiritPriceObservation`.
- Flights reference existing spirits/pours; they never copy dossier content.
- Flight items hold only flight-specific notes/order/pour-size context.
- Standard MVP flight pour size is 1 oz.
- Pricing remains a suggestion via `component_1oz_sum_v1`, not final pricing policy.
- No production DB writes, migrations, importer apply, deploy, merge, or prod env
  changes without Sean approval.

## MVP Template Model

Start with code-defined templates. Do not build a DB-managed template editor yet.

```ts
type FlightTemplate = {
  key: string;
  name: string;
  description: string;
  throughLine: string;
  maxPours: 4;
  slots: FlightTemplateSlot[];
  autoOrder: "slot-order" | "proof-asc" | "proof-desc";
};

type FlightTemplateSlot = {
  key: string;
  label: string;
  rules: FlightTemplateRules;
  itemNote: string;
};

type FlightTemplateRules = {
  proofMin?: number;
  proofMax?: number;
  categories?: string[];
  searchTerms?: string[];
  requiresBottledInBond?: boolean;
};
```

The template provides the narrative through-line. Staff can edit the saved
flight description and per-item notes before publishing.

## MVP Templates

### Proof Ascender

Through-line:

> This proof ladder steps up concentration gradually, showing how alcohol
> density changes aroma, texture, finish, and flavor intensity without rushing
> the palate.

Slots:

- 80-92 proof: light entry point.
- 93-100 proof: balanced core or Bottled-in-Bond range.
- 105-115 proof: dense oils and heavier texture.
- 116+ proof: barrel-proof / uncut intensity.

Why first: this mostly uses existing `SpiritDefinition.proofN`.

### High Proof

Through-line:

> A proof-driven flight built around concentration, texture, heat management,
> and finish length across stronger pours.

Rule:

- `proofN >= 100`
- order by proof ascending by default, with staff override.

Why second: simplest useful template and matches Sean's immediate request.

### Bottled-in-Bond Heritage

Through-line:

> The 1897 Bottled-in-Bond standard creates a controlled comparison: one
> distillery, one season, at least four years old, bottled at exactly 100 proof.

MVP rule:

- proof is 100
- name/style/production text contains `Bottled-in-Bond`, `Bottled in Bond`, or `BiB`

Enrichment later: replace string matching with a real `bottledInBond` metadata field.

### Finished Whiskey

Through-line:

> This flight follows how secondary barrels add fruit, sweetness, spice, smoke,
> or darker texture after primary maturation.

MVP rule:

- whiskey-family categories
- name/style/production text contains finish markers such as `port`, `sherry`,
  `oloroso`, `px`, `madeira`, `rum`, `wine`, `toast`, or `double oak`

Enrichment later: normalize `caskType` and `finishType`.

### Rye Progression

Through-line:

> A rye-focused progression showing how spice, herbal lift, proof, and oak
> structure change across rye styles.

MVP rule:

- category/subcategory contains `Rye`

### House Favorites

Through-line:

> A house-curated flight built from bottles the team is proud to recommend,
> balancing approachability, story, and distinctive flavor.

MVP rule:

- published records with venue voice (`whyWeCarry`, `seanShort`, or `notes`)
- staff manually selects and orders.

## Candidate Eligibility

All template candidate queries must enforce:

- `VenueSpirit.restaurantId = current staff restaurantId`
- `VenueSpirit.recordStatus = PUBLISHED`
- `VenueSpirit.publicationStatus = PUBLISHED`
- `SpiritPour.isPrimary = true` where possible
- `SpiritPour.priceUsd IS NOT NULL`
- `SpiritPour.pourSizeOz IS NOT NULL`
- `SpiritPour.availability` is not a known unavailable/86/inactive value when present

Prefer Toast-backed pours when available:

- `SpiritPour.toastItemGuid IS NOT NULL`
- `SpiritPour.commerceSource = TOAST`

For launch, do not hide all manually confirmed pours if Toast identity coverage is
incomplete. Instead rank Toast-backed pours first and make the source visible to staff.

## Build Order

### Phase 1 - Codex: Template Engine

Files likely involved:

- `src/lib/spirit-vault/flight-templates.ts`
- `src/lib/spirit-vault/flight-template-candidates.ts`
- focused tests beside those files

Deliver:

- Static MVP template registry.
- Candidate resolver scoped by `restaurantId`.
- Slot grouping for `Proof Ascender`.
- Flat candidate pool for `High Proof`.
- Deterministic ordering.
- Tests for tenant scoping, guest visibility, priced-pour requirement, and template rules.

### Phase 2 - Claude: Admin UI Wiring

Files likely involved:

- `src/app/admin/spirit-vault/flights/new/page.tsx`
- existing flight builder components

Deliver:

- Template picker.
- Candidate list grouped by slot where applicable.
- Select up to 4 pours.
- Staff override for order.
- Preset through-line loaded into flight description.
- Slot `itemNote` loaded into each selected flight item.

### Phase 3 - Codex: Save/Validation Hardening

Files likely involved:

- `src/app/admin/spirit-vault/flights/actions.ts`
- `src/app/admin/spirit-vault/flights/actions.test.ts`

Deliver:

- Save remains tenant-scoped.
- Selected pour must belong to selected `VenueSpirit`.
- Flight item count is 2-4 for template-generated launch flows unless existing
  manual builder intentionally allows more.
- DRAFT by default.
- Repricing still uses `component_1oz_sum_v1`.
- Tests cover cross-tenant rejection and stale/ineligible pour rejection.

### Phase 4 - Claude: Placemat Copy + Review

Files likely involved:

- existing placemat/prep sheet renderers
- existing guest flight page

Deliver:

- Through-line appears cleanly.
- Per-pour "what to notice" notes render from flight items.
- Print layout still fits real data.
- No guest-facing mention of internal template mechanics.

### Phase 5 - Codex: Verification

Run before asking Sean for any deploy/migration approval:

```powershell
npx.cmd prisma generate
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
```

If database verification is needed, use only approved non-production targets and
explicit `restaurantId`. Do not apply migrations to production without Sean approval.

## Enrichment Backlog

These improve the engine but should not block the end-of-week MVP.

### Better Metadata

Add structured metadata gradually:

- `bottledInBond`
- `barrelProof`
- `singleBarrel`
- `mashBill` / grain percentages
- `caskType`
- `finishType`
- `ageStatement`
- `entryProof`
- `distilleryDsp`
- `producerType` / sourced vs distilled
- `additivesPresent`
- `chillFiltered`
- `glasswareRec`
- `waterDropsRec`

Rule of thumb:

- Promote to columns only when needed for frequent filtering/sorting/reporting.
- Keep rich dossier details in structured JSON until usage proves the shape.

### Better Templates

Add after the first two launch templates:

- Secondary Grain Evolution
- Maturation Arc
- Agave Terroir
- Single Distillery Vertical
- Rum: Light to Dark
- Smoke & Peat
- Beginner Friendly
- Splurge Flight
- Under-the-Radar
- Staff Picks

### Intelligence Layer

After guest ratings/passport data exists:

- Track template usage.
- Track bottle inclusion in flights.
- Track guest ratings by flight/template.
- Suggest owner monthly reports.
- Recommend inventory gaps from anonymized aggregate trends.
- Add distillery "From the Distiller" content as labeled, owner-approved data.

## Lane Split

Codex owns:

- Template rule engine.
- Candidate resolver.
- Tenant safety.
- Server actions / persistence validation.
- Tests and build gates.
- DB/migration review.

Claude owns:

- Admin workflow design.
- Template picker UI.
- Candidate selection UI.
- Guest/placemat presentation.
- Copy polish and print layout.

Sean gates:

- Production DB migrations.
- Production deploys.
- Merge to `main` when it would deploy.
- Final flight template names/copy.
- Whether manually confirmed non-Toast pours can be used in launch flights.
