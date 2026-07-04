# SPEC D — Concierge Onboarding + Universal CSV Spine

**Suggested branch:** `claude/spec-d-concierge-csv-spine`
**Depends on:** Spec C (ConnectionRequest model, sourceLadder registry, /admin/provisioning). Ships after Spec C merges. Independent of Specs A and B — but everything here writes to the clean ledger spine, so Spec A convergence covers it for free.
**Prime directive:** Concierge, CSV, and one-click connect are three *entry methods* into one ingestion pipeline. No forked codepaths. If a change requires branching business logic on "how the data got here," the design is wrong.

---

## Part 1 — Concierge Tier Definition

### 1.1 What it is

Concierge = an OutFront staff member (Sean, initially) executing the same onboarding steps a self-serve client would, using the same UI, flagged and audited. It exists for (a) gated sources with no client-reachable API (Toast pre-Partner-Connect, MarginEdge), (b) early adopters we want live in one call, (c) clients who stall in the wizard.

Positioning language is already locked from the white-glove playbook: **"You will never be asked for an API key."** Concierge is framed as concierge, never as a product limitation.

### 1.2 Division of labor

| Step | Client does | OutFront does | Artifact |
|---|---|---|---|
| Cash anchor | States current bank balance on kickoff call | Enters it, timestamps it | `cashBalanceAnchor` |
| Plaid link | **Always the client.** Staff never touches bank credentials — screen-share guidance only | Guides, verifies accounts landed | Plaid Item |
| Toast (pre-Spec-B) | Adds staff as Toast Web user (Template A email, 1-business-day SLA) | Stores creds encrypted → PosConnection, verifies first pull | ConnectionRequest → LIVE |
| MarginEdge | Signs authorization one-liner (Template B) | Submits support key request (Template C), waits "a few days," never promises a date | ConnectionRequest → PROVISIONING |
| Historical data | Emails/uploads exports (see Part 2 report list) or forwards PDF statements | Runs imports on client's behalf via admin console | ImportBatch rows |
| Vendor mapping | Approves the mapping in one review pass | Does first-pass categorization + rules | Rule rows |
| Invites | Names the people | Sends invites, sets roles | UserRestaurantRole |

**Hard rule:** staff never holds client bank credentials, and Plaid Link is always client-driven. Everything else is delegable.

### 1.3 What we need from the client (kickoff checklist, one email)

1. Current operating-account balance (the anchor).
2. 15 minutes on a call to click through Plaid Link.
3. Toast Web user invite to ops@outfrontdata.com (Template A) — restaurants only.
4. Signed MarginEdge authorization (Template B) — if they use it.
5. Last 90 days of exports per Part 2 report list, or PDF statements as fallback.

### 1.4 Concierge → self-serve conversion path

- **Registry-driven, zero rework.** `sourceLadder.ts` already carries `method`. When Spec B lands, Toast flips `white-glove → oauth` in the registry and the wizard/hub update themselves. Same pattern for any future connector.
- **ConnectionRequest is the conversion ledger.** REQUESTED→AUTHORIZED→PROVISIONING→LIVE stays the lifecycle regardless of who does the work. Add one field: `provisionedBy: 'CLIENT' | 'STAFF'`. Over time the STAFF ratio per source tells you exactly which rung to automate next.
- **Cost telemetry.** Add `staffMinutes Int?` to ConnectionRequest, filled in by the admin console on completion. When staffMinutes × client count for a source exceeds the build cost of automating it, that's the trigger — data, not vibes.
- **Graduation:** a tenant is "self-serve" when all Rung-1 sources are LIVE with no STAFF-provisioned request in the last 30 days. Badge it on /admin/provisioning so the queue shows who still needs hand-holding.

### 1.5 Admin console (extends Spec C item 5)

`/admin/provisioning` gains:
- **Act-on-behalf mode:** admin selects a tenant, gets the same /settings/sources and import UI the client sees, banner "Acting on behalf of {tenant}," every write stamped with `actorUserId` + `onBehalfOf` in an `AdminActionLog` row. This is impersonation-lite — read/import/connect only, no destructive actions, no role changes.
- Per-request `staffMinutes` capture on status → LIVE.
- SLA timers (Toast 1 business day, MarginEdge open-ended) with overdue flags.

---

## Part 2 — CSV Spine

### 2.1 What clients can actually export (per vertical)

These are the reports we tell them to pull — named exactly, so Template emails can reference them.

**Restaurant**
- Toast: *Sales Summary* (daily net sales, tax, tips) + *Payments* export — covers earned-sales allocation basis when API isn't live yet.
- Bank: transaction CSV from online banking (every major bank offers it) — Plaid substitute/backfill.
- MarginEdge: *Purchases/Invoices* export — COGS detail.
- Payroll (Toast Payroll / Gusto / ADP): *Payroll Register* export — unlocks forward payroll-tax accrual later (currently cleared-pulls-only debt).

**Brokerage** — already live: FUB/closing CSV pipeline. Fold into this schema, don't rebuild.
**Vacation rental** — already live: reservations + owner-statement CSV. Same.
**Universal fallback** — PDF statement via existing LLM import when the bank CSV is ugly. PDF import should emit the same canonical rows (§2.2) so it stops being a separate path.

### 2.2 Canonical import schema

One shape. Every adapter maps into it; nothing downstream knows or cares about the source file format.

```ts
// src/lib/import/canonical.ts
export interface CanonicalRow {
  occurredAt: Date;          // required
  amountCents: number;       // required, signed: inflow +, outflow −
  description: string;       // required, raw
  counterparty?: string;     // vendor/payer if the source separates it
  externalId?: string;       // source's own txn/check/reservation id if present
  sourceKey: SourceKey;      // from sourceLadder registry
  rowHash: string;           // sha256(sourceKey|occurredAt|amountCents|normalized description|externalId)
  currency: 'USD';
  meta: Record<string, unknown>; // everything else, preserved verbatim
}
```

Pipeline: `CanonicalRow → RawSourceEvent → NormalizedFinancialEvent → categorize() → LedgerEntry | SyncException`. Identical to the Plaid dual-write. CSV rows are ledger-first citizens from day one — no legacy-spine writes from CSV.

### 2.3 New Prisma models (additive migration only)

```prisma
model ImportBatch {
  id             String   @id @default(cuid())
  restaurantId   String
  sourceKey      String
  filename       String
  fileChecksum   String   // sha256 of file bytes — re-upload = no-op
  uploadedById   String
  onBehalfOf     Boolean  @default(false)  // concierge flag
  rowCount       Int
  acceptedCount  Int
  rejectedCount  Int
  duplicateCount Int
  status         ImportBatchStatus // PARSING | REVIEW | COMMITTED | FAILED
  createdAt      DateTime @default(now())
  @@unique([restaurantId, fileChecksum])
}

model ImportMapping {
  id           String @id @default(cuid())
  restaurantId String
  sourceKey    String
  headerHash   String   // sha256 of sorted header row
  columnMap    Json     // { "Post Date": "occurredAt", "Amount": "amountCents", ... }
  @@unique([restaurantId, sourceKey, headerHash])
}
```

`RawSourceEvent` gains `importBatchId String?` — that plus existing sourceKey is full provenance: every ledger dollar traces to file → batch → row hash → uploader.

### 2.4 Identity matching / dedupe (CSV blended with a connected source)

The real risk: client uploads a bank CSV covering March, then connects Plaid, which backfills March. Double-count = allocation engine lies = product dead. Rules, in order:

1. **Intra-source idempotency:** `rowHash` unique per tenant+source. Re-uploading the same file or overlapping exports is a silent skip, counted in `duplicateCount`.
2. **Cross-source exact match:** same `externalId` OR (amountCents exact + occurredAt within ±1 day + normalized-description Jaccard ≥ 0.8) between a CSV row and an API/PDF row → **merge, don't drop**: higher-trust source's row becomes the LedgerEntry; lower-trust row is linked as `corroboratesEventId` on NormalizedFinancialEvent. Trust order extends the existing signals.ts source-trust concept: **API > CSV > PDF-LLM**.
3. **Cross-source fuzzy suspect:** amount exact + date within ±3 days but weak description match → do NOT auto-merge. Emit `SyncException` with `issueType: DUPLICATE_SUSPECT`, both rows attached, one-click "same transaction / different transaction" in the review flow.
4. **Allocation reads deduped ledger only.** Corroboration rows never hit TAP math.

This lands in `src/lib/import/dedupe.ts`, pure functions, table-driven tests.

### 2.5 Import UX (`/settings/sources/import/[sourceKey]`)

1. **Drop file** → parse headers → auto-detect via known-format signatures (ship signatures for Toast Sales Summary, Chase/BofA/PNC/M&T bank CSVs, MarginEdge, Gusto) → else fall back to saved ImportMapping for this header hash → else manual column mapper (dropdown per required field).
2. **Preview:** first 20 mapped rows rendered as they'll land, with running accepted/rejected/duplicate counts for the full file.
3. **Validation tiers:**
   - **Blocking:** required column unmappable → no commit, tell them exactly which column and show the header row.
   - **Row-reject:** unparseable date/amount, zero-amount rows → excluded, downloadable `rejects.csv` with a reason column per row. Partial commit is allowed and normal.
   - **Warning:** future-dated rows, rows older than 24 months, DUPLICATE_SUSPECTs → committed or excepted per §2.4, surfaced in summary.
4. **Commit** → ImportBatch COMMITTED, summary card: "412 accepted · 3 rejected (download) · 61 duplicates skipped · 2 need review," with the review link pointing at the existing /settings/sources/review flow. No new review surface.
5. Mapping saved automatically → second upload from the same tool is drag-and-done.

Concierge uses this exact screen in act-on-behalf mode. Nothing forked.

---

## Part 3 — Coexistence Architecture

```
 one-click (Plaid/Toast oauth)  ─┐
 CSV upload (client)            ─┤→  CanonicalRow → RawSourceEvent → Normalize
 CSV/creds via concierge (staff)─┘        → categorize() → LedgerEntry | SyncException
                                                → /settings/sources/review (one surface)
```

- **One registry** (`sourceLadder.ts`) declares every source's method, rung, and CTA. Concierge and CSV are `method` values, not products.
- **One lifecycle** (ConnectionRequest) tracks provisioning regardless of actor; `provisionedBy` + `staffMinutes` are the only concierge-specific fields.
- **One pipeline** — CanonicalRow contract means a new source = one adapter file + one format signature + tests. Plaid, PDF-LLM, and every CSV adapter converge here; long-term, refactor the PDF importer to emit CanonicalRow and delete its bespoke path.
- **One review surface** — dedupe suspects, categorization exceptions, and import warnings all flow to the existing exceptions review. Richer review controls (approve-as-category, rule-save, bulk-apply) remain the separate backlog item from Chunk 1; this spec doesn't build them but everything it emits benefits when they land.

**Anti-bloat guardrails:** no per-source import UIs, no import "wizard v2," no client-visible admin features. Rung-3 sources (QBO, payroll APIs, MarginEdge API) stay locked tiles; their CSV exports are the interim answer.

---

## Build order (Claude Code)

1. Prisma: ImportBatch, ImportMapping, RawSourceEvent.importBatchId, ConnectionRequest.provisionedBy/staffMinutes, AdminActionLog. Additive only.
2. `src/lib/import/canonical.ts` + `dedupe.ts` + adapters: `toastSalesSummary.ts`, `bankGeneric.ts`, `marginEdgePurchases.ts` (brokerage/rental adapters = refactor existing pipelines onto CanonicalRow, behavior-identical).
3. `/settings/sources/import/[sourceKey]` UI + mapping persistence.
4. /admin/provisioning: act-on-behalf, staffMinutes, SLA timers, AdminActionLog.
5. Vitest: canonical mapping per adapter (fixture files), dedupe table-driven cases (exact/fuzzy/suspect/idempotent re-upload), batch idempotency, gate that corroboration rows never reach allocation. Keep 196 green.

**Out of scope:** Spec A execution, Spec B, Rung-3 connectors, review-flow enhancements, retro-recategorization.
