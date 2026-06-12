# Spec: Profit First Allocation & Variance Engine

> **Status:** specced, not built. Simulation mode only (no real money / Dwolla out of scope).
> Supersedes the lightweight "Allocation Advisor" sketch — this is the real engine.
> Operator-provided spec captured verbatim at the bottom; the two sections below
> map it onto what already exists in the repo and list the decisions that must be
> made before the migration is written.

---

## A. What already exists (reuse — do NOT recreate)

- **`TapSettings`** (`prisma/schema.prisma`) — TAP percentages + `simulationMode Boolean @default(true)`.
  Current defaults: profit 5, ownerPay 5, cogsFood 18, cogsLiquor 12, **labor 32, opex 28, NO spill**.
- **`VirtualAccount`** — *already* "one running virtual balance per bucket per restaurant"
  (`key`, `name`, `balance`, `targetPct`). This is the existing scaffold for the spec's
  `BucketBalance`. **Extend this, don't add a parallel table.**
- **`calculator.ts`** (`src/lib/profit-first/`) — `calculateRealRevenue(totalRevenue, foodCogs, liquorCogs)`,
  `calculateTargets(base, taps)`, usage/health. `Taps`/`Targets` interfaces have **no spill** field.
- **`DailySales`** — `netSales`, `foodSales`, `liquorSales`, `beverageSales`, `laborCost` →
  the **EARNED (allocation basis)** source. Already exists; reuse as the Toast/MarginEdge basis.
- **`PlaidConnection` + `Transaction`** — the **BANKABLE** feed. `isRecurring` exists.
- **Categorization engine** (`src/lib/categorization/{categories,rules,suggestions,vendor-map}.ts`) —
  already recognizes **Davo → TAX_SALES** and **MarginEdge → OPEX_SUPPLIES** by vendor name.
- **Inngest** (`src/lib/inngest/functions.ts`) — `dailyPlaidSyncScheduler` (6am ET cron) + per-connection
  `runPlaidSync`, event `plaid/connection.sync.requested`. New allocation jobs hook in here.
- **`simulationMode`** already on `TapSettings` (default true) — reuse, matches "no real money."
- **No live MarginEdge / Davo / Toast API yet** — only vendor-name recognition in the Plaid feed.
  Until those land (Toast wave), the "invoice synced / pull cleared" events are driven by
  **Plaid-cleared transactions matched by vendor** + the rolling-COGS-rate TAP fallback. The spec's
  "fallback to TAP target where integrations don't exist" already anticipates this.

## B. OPEN DECISIONS — conflicts with previously-locked state (resolve before migration)

1. **TAP split changes the live numbers.** Existing defaults are Labor **32** / OpEx **28** / no Spill.
   This spec locks Labor **27** / OpEx **20** / **Spill 13** (Profit 5, Owner 5, COGS 30 unchanged).
   → Add `spillPct` (default 13), change labor 32→27 and opex 28→20. **Customer Zero's existing
   `TapSettings` row must be data-updated** (defaults only apply to new rows). Confirm 27/20/13 is the
   new locked split.
2. **Spill is a brand-new bucket** — absent from `TapBucket` enum, `Taps` interface, `VirtualAccount`
   keys, and the calculator. Must be threaded through everywhere. Accrue-only.
3. **Beer/beverage treatment conflicts with an earlier lock.** Prior locked decision:
   "COGS_BEVERAGE = its own gauge line" (beer separate from liquor). This spec models COGS as
   **Food 18 / Liquor 12 only**, folding beer/wine into **COGS Liquor**. → For the allocation engine,
   does beer fold into Liquor (2-way, as written) or stay a 3rd line? Spec says fold; confirm it
   overrides the earlier "beer its own line" for allocation (the dashboard gauge can stay 3-way).
4. **Bucket ledger: extend `VirtualAccount` vs new `BucketBalance`.** Recommend **extend
   `VirtualAccount`** (add a `bucketType` enum, `lastAllocatedAt`, `lastSweptAt`) rather than a
   parallel table, per the spec's own "don't recreate scaffolded tables." Confirm.
5. **Bucket-type enum naming.** Spec lists `OWNERS_PAY`; existing code uses `OWNER_PAY` (and
   VirtualAccount key `owner_pay`). Align on **`OWNER_PAY`**. New enum is a superset adding
   `PROFIT`, `SPILL`, `TAX_RESERVE_SALES`, `TAX_RESERVE_PAYROLL`.
6. **Cross-ref Tax Vault.** This spec's "skim Davo's *actual* pull, never estimate 6%" is exactly the
   correct-source fix logged for the Tax Vault tile. The Tax Reserve sales sub-ledger and Tax Vault
   should share one source of truth (Davo actuals via the Plaid feed).

## C. Proposed schema diff (for sign-off — migration NOT yet written)

- `TapSettings`: + `spillPct Decimal @default(13.00)`; change `laborPct` default → 27.00, `opexPct` → 20.00; + data-update for Customer Zero.
- New enum `BucketType { PROFIT OWNER_PAY COGS_FOOD COGS_LIQUOR LABOR OPEX SPILL TAX_RESERVE_SALES TAX_RESERVE_PAYROLL }`.
- `VirtualAccount`: + `bucketType BucketType?`, `lastAllocatedAt`, `lastSweptAt` (reused as BucketBalance).
- New models (FK → Restaurant, tenant-scoped): `BucketAllocation`, `TaxObligation`, `BucketObligation`, `BucketReconciliation` (fields per operator spec below).
- `calculator.ts`: add `spillPct` to `Taps`/`Targets`; add the pre-allocation tax-skim + rolling-COGS-rate helpers.

---

## D. Operator spec (verbatim)

# HANDOFF: Profit First Allocation & Variance Engine

The repo already has TAP percentages and a calculator that computes allocation *targets*. What's missing is the layer that makes Profit First real:

1. **Allocation engine** — splits daily Real Revenue into virtual bucket balances on a daily cadence.
2. **Bucket balances** — running per-bucket virtual ledger that accrues and draws down over time.
3. **Obligation tracking** — what each bucket actually owes, pulled from real data.
4. **Variance layer** — per bucket, the dollar gap and percentage difference between what's allocated and what's owed, surfaced as actionable green/yellow/red signal.

The buckets are fictitious (virtual accounting, simulation mode — no real money moves yet). The numbers feeding them are real (synced). The output is a variance read that drives operator action.

### TAP PERCENTAGES (locked)

| Bucket | TAP | Notes |
|---|---|---|
| Profit | 5% | accrue-only, swept twice monthly |
| Owner's Pay | 5% | accrue-only, swept twice monthly |
| COGS | 30% | tracked as Food 18% / Liquor 12% under the hood; rolls up to one 30% COGS line in the main view |
| Labor | 27% | draws down as payroll clears |
| OpEx | 20% | draws down as recurring expenses clear |
| Spill | 13% | reserve for marketing + renovation; accrue-only |
| **Total** | **100%** | |

Store COGS as two sub-allocations (Food 0.18, Liquor 0.12) summing to the parent COGS bucket. Main view shows COGS as one line; the beverage-program drill-down shows Food and Liquor split.

Sales tax and payroll tax are excluded from the TAP split — but NOT ignored. They are skimmed off the top BEFORE the TAP split runs (see Pre-Allocation Tax Skim). The TAPs allocate only what remains after tax is reserved.

### ALLOCATION CADENCE: DAILY

Allocation runs on every settled bank deposit as it lands, not on a calendar.

Deposit pattern (build and test against this):
- **Monday** = one large settlement batching Fri+Sat+Sun card sales (~3x a weekday)
- **Tue/Wed/Thu** = normal single-day card settlements
- Occasional **event-deposit check** (manual or Plaid-detected)

The Monday lump spikes every bucket's allocation that day. The engine must NOT read variance day-by-day — a bucket looking underwater Tue–Thu is normal because the weekend cash hasn't been earned-down against the week's obligations. **Variance is computed on a rolling 7-day trailing window.** Daily allocation, weekly variance truth.

### CRITICAL: EARNED vs. BANKABLE

This operation pays cash tips out daily. Cash sales walk back out same-day as tip payouts. The bank deposit feed is functionally *card settlements only* (plus rare event checks).

- **EARNED (allocation basis):** daily net sales from **Toast/MarginEdge** — sees cash + card. `Real Revenue = Net Sales − COGS`.
- **BANKABLE (fundability check):** the **Plaid deposit feed** — confirms cash actually landed.

For this operator the two are nearly identical (cash leaves as tips), but source the allocation basis from Toast/MarginEdge so the engine doesn't break on a big cash event or a tip-out change.

**COGS derivation for daily allocation:** MarginEdge invoices are too laggy to gate a daily allocation. So:
- On each allocation, derive Real Revenue using a **rolling COGS rate** (default to the 30% TAP target) applied to that day's net sales.
- **True it up** when actual MarginEdge invoices land — reconcile the COGS bucket and adjust the running balance.
- Rolling-rate-then-reconcile is the only approach that works at daily cadence.

### PRE-ALLOCATION TAX SKIM (Tax Reserve bucket)

Davo (sales tax) and Toast Payroll (payroll tax) pull money AFTER the deposit lands. The gross settlement includes sales tax + payroll tax owed — never the operator's money. Running the TAP split on the full deposit would allocate dollars Davo/Toast claw back → false-green buckets.

**Fix: tax off the top BEFORE the TAP split.** Per deposit:
1. Deposit lands (gross card settlement)
2. Skim sales tax → Tax Reserve
3. Skim payroll tax (accrued daily) → Tax Reserve
4. Remainder is allocable → derive Real Revenue → run the TAP split (5/5/30/27/20/13)

**Tax Reserve bucket** — a pass-through holding bucket (not a TAP bucket competing for 100%). Two sub-ledgers:
- **Sales Tax** — skim **Davo's actual daily pull** (do NOT estimate 6%). PA rule: 6% on food + non-alcoholic beverages only; **ALL alcohol is sales-tax exempt** (retail liquor license, York County PA; no liquor-by-drink tax — that's Philly/Allegheny only). Operator holds NO Wine Expanded Permit and sells NO RTD cocktails → no taxable-alcohol edge cases. Skim Davo's actual figure regardless. Basis: daily. Draws down daily as Davo pulls.
- **Payroll Tax** — accrue liability **daily** as Toast Payroll syncs (employer FICA/FUTA/SUTA + employee withholdings). Draws down on the **Thursday** Toast Payroll pull. Daily accrual means Thursday isn't a cash cliff.

**Tax Reserve variance** — binary, not green/yellow/red: **OK** (reserve ≥ upcoming pull) or **SHORT** (reserve < upcoming pull → five-alarm flag, top alert priority above operating-bucket signals).

### OBLIGATION SOURCES (connected → fallback)

| Bucket | Obligation source (connected) | Fallback |
|---|---|---|
| COGS Food | MarginEdge invoices | TAP target |
| COGS Liquor | MarginEdge / distributor invoices (PLCB, beer, wine) | TAP target |
| Labor | Toast Payroll actuals | TAP target |
| OpEx | Plaid-categorized recurring expenses | TAP target |
| Profit / Owner's Pay / Spill | none — accrue only | — |

### BUCKET DRAW-DOWN

- **COGS / Labor / OpEx** — accrue from daily allocation AND draw down as real payments clear Plaid. Balance = (allocated to date) − (cleared payments to date).
- **Profit / Owner's Pay / Spill** — accrue-only. Profit + Owner's Pay swept **twice monthly on the 10th & 25th**. Spill swept manually when deployed.

### THE VARIANCE LINE

Per draw-down bucket, on the rolling 7-day window:
```
dollar_gap      = allocated_balance − obligations
percentage_diff = (allocated_balance − obligations) / obligations
```
Signals (configurable constants): GREEN gap ≥ +5%; YELLOW −5%..+5%; RED < −5%. Dollar gap is the primary read; percentage secondary. Profit/Owner's Pay/Spill show accrued balance + progress toward next sweep (no variance).

### SCHEMA ADDITIONS (build on existing relations)

- **`BucketBalance`** — running virtual balance per bucket per restaurant: restaurantId, bucketType (PROFIT, OWNERS_PAY, COGS_FOOD, COGS_LIQUOR, LABOR, OPEX, SPILL, TAX_RESERVE_SALES, TAX_RESERVE_PAYROLL), currentBalance, lastAllocatedAt, lastSweptAt.
- **`BucketAllocation`** — per allocation event: restaurantId, allocationDate, grossDeposit, salesTaxSkimmed, payrollTaxSkimmed, allocableRemainder, netSalesBasis, derivedRealRevenue, cogsRateUsed, source (TOAST|MARGINEDGE|MANUAL), per-bucket amounts. Store the gross→allocable waterfall (auditable) + raw basis (for reconciliation).
- **`TaxObligation`** — restaurantId, taxType (SALES|PAYROLL), amount, source (DAVO|TOAST_PAYROLL), accruedAt, pullDueAt, clearedAt (null until real pull clears). Drives binary Tax Reserve variance.
- **`BucketObligation`** — restaurantId, bucketType, amount, source (MARGINEDGE|TOAST_PAYROLL|PLAID|TAP_FALLBACK), sourceRef, incurredAt, clearedAt.
- **`BucketReconciliation`** — restaurantId, allocationId, estimatedCogs, actualCogs, adjustmentAmount, reconciledAt.

Use existing tenant/org scoping + roles: Operator full, Consultant read-only multi-client, Investor read-only selected. Variance detail = Operator + Consultant; Investor sees accrued Profit/Owner's Pay summary only.

### INNGEST JOBS

- **On Plaid deposit settled** → skim sales + payroll tax into Tax Reserve (record waterfall), then derive Real Revenue on the remainder via rolling COGS rate, write BucketAllocation, increment balances.
- **On Davo pull cleared** → match TaxObligation (SALES), set clearedAt, decrement Tax Reserve sales.
- **On Toast Payroll pull cleared (Thursday)** → match TaxObligation (PAYROLL), decrement Tax Reserve payroll.
- **On Plaid payment cleared** → match BucketObligation, decrement the draw-down bucket.
- **On MarginEdge invoice synced** → write/update BucketObligation (COGS), run BucketReconciliation true-up.
- **On Toast Payroll synced** → write BucketObligation (Labor) + accrue daily payroll-tax into TaxObligation.
- **Daily** → recompute rolling 7-day variance per operating bucket; recompute binary Tax Reserve OK/SHORT; update signal states.
- **10th & 25th** → sweep Profit + Owner's Pay (simulation: zero bucket, log sweep; no ACH).

### BUILD ORDER

1. Read existing schema + calculator + categorization engine; report what's there. ✅ done — see sections A/B above.
2. Schema additions + migration.
3. Pre-allocation tax skim + Tax Reserve bucket (sales daily, payroll daily-accrual / Thursday-pull).
4. Allocation engine (daily, earned-basis, rolling COGS rate) on the allocable remainder.
5. Obligation tracking + draw-down (Plaid clear matching); tax-pull matching for Tax Reserve.
6. MarginEdge reconciliation true-up.
7. Rolling 7-day variance + signal state; binary Tax Reserve OK/SHORT.
8. Inngest wiring.
9. Surface on dashboard: variance line per operating bucket; Tax Reserve OK/SHORT as top-priority alert.

Simulation mode only — Dwolla ACH "Go Live" out of scope for this build.
