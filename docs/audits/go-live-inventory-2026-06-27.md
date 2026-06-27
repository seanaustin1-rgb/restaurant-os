# Go-Live Inventory - 2026-06-27

Branch audited: `feat/heartbeat-landing`

This checkpoint separates what is already active from what is merely scaffolded, and names the next work queue for early-adopter readiness.

## Current Commit Trail

Recent go-live infrastructure commits:

- `688243d` - Use clean ledger for Cash Oxygen
- `d7ead0e` - Add financial mapping review workflow
- `5dba26b` - Mirror bank imports into financial ledger
- `ee2be6f` - Add financial sync health panel
- `0881a1e` - Add financial source ingest bridge
- `0cd3684` - Add isolated financial ledger schema
- `a58bf90` - Add Cash Oxygen floor calculation
- `35d538a` - Fix demo mobile clipping
- `b572ee9` - Add Live Heartbeat marketing landing at `/heartbeat`
- `db71649` - Add onboarding review screenshots
- `baaeb0a` - Polish mobile onboarding guidance
- `2a22cf8` - Finish industry-specific onboarding paths

## Built And Pushed

### Public Demo / Funnel

- `/demo/tour` includes an industry template picker.
- Industry demo tours exist for restaurant, service, contractor, real estate brokerage, vacation rental, and retail.
- Mobile clipping fixes were applied to the public demo estimator/tour views.
- Demo screenshots were saved in `docs/screenshots/onboarding-2026-06-27`.
- Demo estimators have industry-specific inputs and source-pipe language for service, contractor, retail, real estate, and vacation rental.

### Onboarding / Source Setup

- Industry-specific onboarding paths exist.
- `/settings/sources` is the main source onboarding hub.
- Owner authorization guidance exists for bank and Google Business Profile.
- Google Business Profile authorization/location-selection/disconnect flows exist.
- Source planning can mark systems as connected, planned, blocked, or not needed.
- Device guidance says phone is fine for planning, computer recommended for authorization/upload/bulk cleanup.

### Access / Roles

- Roles in use: Operator, Manager, Consultant, Investor.
- Access management exists at `/settings/access`.
- Investor matrix exists at `/investor`.
- Investor access is owner-approved and read-focused.
- Sensitive authorizations are owner/operator controlled.

### Financial Ledger Isolation

- Prisma schema now has the clean ledger boundary:
  - `RawSourceEvent`
  - `NormalizedFinancialEvent`
  - `LedgerEntry`
  - `SourceMappingRule`
  - `SyncException`
- Migration exists and was applied to the connected database:
  - `20260627183000_add_financial_ledger_isolation`
- Reference doc exists:
  - `docs/specs/financial-ledger-isolation.md`
- This supports the anti-bloat strategy: messy POS/QBO/CRM/PMS payloads stay quarantined; dashboard math should read clean, reviewed financial facts.

### Sync Health / Review

- `/settings/sources` now has a Financial data safety panel.
- `/settings/sources/review` lists pending financial mapping items.
- Operator/manager/consultant users can approve items into the clean ledger.
- Operator/manager/consultant users can exclude items from dashboard math.
- Approving/excluding resolves related sync exceptions.

### Bank Data Into Ledger

- Plaid sync now dual-writes bank transactions into:
  - raw source events
  - normalized financial events
  - ledger entries when approved/high-confidence
  - sync exceptions when review is needed
- Manual statement import also dual-writes into the clean ledger.
- Plaid removals remove mirrored clean-ledger rows too.
- Backfill script exists:
  - `scripts/backfill-bank-transactions-ledger.ts`

### Cash Oxygen / Go-Live Foundation

- Cash Oxygen Floor calculation exists.
- Cash Oxygen now prefers the clean ledger when ledger fixed-burn entries exist.
- Cash Oxygen falls back to anchor-plus-transactions when the ledger is not ready.
- Cash Oxygen UI shows source state:
  - Ledger-backed
  - Bank estimate
  - Live balance
  - Needs setup
- Go-Live Coach reads Cash Oxygen values and uses them in cash safety evaluation.

## Live Data Snapshot

Connected database counts after backfill:

| Business | Transactions | Raw source events | Normalized events | Ledger entries | Sync exceptions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sandbox Diner | 48 | 48 | 48 | 0 | 48 |
| Demo Bistro | 32 | 32 | 32 | 64 | 0 |
| Stone Grille and Tap House | 928 | 928 | 928 | 1,104 | 373 |

Unresolved exceptions:

- Stone Grille and Tap House: 373 warning-level items.
- Sandbox Diner: 48 warning-level items.
- Demo Bistro: 0 open items.

Interpretation:

- Stone is fully mirrored into the new ledger source layer.
- Stone is not fully review-clean yet.
- Demo Bistro is clean enough to demonstrate the ledger flow.
- Sandbox needs mapping/category review before its ledger can be trusted.

## Active vs Scaffolded

### Active Now

- Source onboarding hub.
- Google Business Profile OAuth/location/disconnect flow.
- Role-based access and investor page.
- Financial safety panel.
- Mapping review page.
- Bank/statement dual-write into clean ledger.
- Cash Oxygen ledger-preferred calculation.
- Go-Live Coach cash-safety dependency on Cash Oxygen.

### Scaffolded But Not Fully Driving Dashboard Yet

- The clean ledger exists, is populated, and has review tooling.
- Most dashboard modules still read legacy/current domain tables first.
- Cash Oxygen is the first dashboard module with ledger-first behavior.
- Tax Vault, cash flow, spending, break-even, and investor views are not yet fully ledger-backed.
- `SourceMappingRule` is present in the schema and bridge logic, but no full UI exists yet for source-specific mapping rules.
- The review page approves/excludes pending events, but does not yet let the user change event type/account/category inline.

## Known Gaps

### Data Trust / Cleanup

- Stone has 373 warning-level clean-ledger mapping issues to review.
- We need a summary of which categories/vendors cause the warnings.
- Sandbox has 48 warnings and 0 ledger entries, likely because the rows are unmapped or low-confidence.
- Current review flow is approve/exclude only; it does not yet provide "approve as Rent / Labor / Tax / Excluded" controls.

### Ledger Adoption

- Cash Oxygen is ledger-first.
- Go-Live Coach indirectly benefits through Cash Oxygen.
- Tax Vault still needs a ledger-first path, especially because DAVO pulls sales tax daily.
- Cash Flow and Spending modules should eventually read `LedgerEntry.cashEffect` and ledger accounts.
- Investor matrix should eventually read clean ledger facts for guaranteed access.

### Onboarding / Consultant Workflow

- Consultants/accountants can review mappings, but need richer adjustment controls:
  - change category/account
  - save a future mapping rule
  - bulk-apply similar mappings
  - add notes explaining why an item was excluded
- Owner authorization can be turned off for Google; bank authorization management points to `/connections`.
- Need a clearer admin/support path for provider credentials that cannot be OAuth self-served.

### Demo / Product Story

- Public demos are improved but should be rechecked after design overlay.
- Profit First explanation exists, but can be stronger in plain language:
  - owner pay and profit are reserved first
  - business operates on the rest
  - Go-Live Coach simulates before real money moves
- Coach wording still needs continued copy polish so users understand "what kind of coach" it is.

### Deployment

- Branch `feat/heartbeat-landing` is pushed.
- Connected database migration was applied.
- Need to confirm Vercel/prod deployment target before merging or deploying.
- Need to confirm required env vars in Vercel:
  - database URLs
  - Clerk
  - Google Business Profile
  - Plaid
  - Toast
  - Inngest / background jobs

## Recommended Next Work Queue

### P0 - Make Stone's Ledger Trustworthy

1. Add a mapping exception summary grouped by source, category, merchant, and event type.
2. Extend `/settings/sources/review` so each pending item can be approved with a chosen ledger account/event type.
3. Add "apply to similar future imports" from the review flow.
4. Review Stone's 373 warning items and reduce open exceptions.

### P0 - Tax Vault / DAVO Accuracy

1. Make Tax Vault ledger-aware.
2. Treat Toast collected sales tax as tax liability source.
3. Treat DAVO daily pulls as tax clearing events.
4. Show whether tax reserve is sourced from POS, bank, or clean ledger.

### P1 - Go-Live Coach Tightening

1. Make Go-Live Coach explicitly show whether it is using ledger-backed, estimated, or missing inputs.
2. Add a pilot checklist:
   - clean ledger has no blocking exceptions
   - tax source is connected
   - cash anchor exists
   - fixed burn is ledger-backed
   - target allocations are reviewed
3. Keep real money movement disabled until the virtual pilot passes.

### P1 - Consultant / Accountant Controls

1. Add richer mapping review controls.
2. Add a consultant-facing "needs client action" summary.
3. Add bulk mapping approval for repeated vendors.
4. Add an audit trail for who approved/excluded each item.

### P1 - Dashboard Ledger Adoption

1. Cash Flow: prefer ledger `cashEffect`.
2. Spending: prefer ledger accounts/categories.
3. Break-even: prefer reviewed fixed OpEx and prime-cost inputs.
4. Investor Matrix: prefer clean ledger facts and hide operational setup details.

### P2 - Demo / UX Polish

1. Re-run mobile screenshots after Claude design overlay.
2. Tighten Profit First explanation and Go-Live Coach copy.
3. Recheck public demo estimator/tour routes for business-type drift.
4. Make "what can I manipulate to change outcomes" explicit in the demos and dashboards.

## Do Not Forget

- Sales tax is pulled daily by DAVO.
- The product should stay anti-bloat: consume CRM/POS/PMS/accounting data, but do not become a CRM, compliance checklist, or accounting suite.
- When a source fails or maps poorly, show the issue clearly. Silent sync failure is not acceptable.
- Consultants/accountants need adjustment power, but owner/operator controls sensitive authorizations.
- Investor access should be guaranteed and clean, but limited to the matrix/read-only view.

