# Restaurant OS — Session Handoff

> Safe to email — contains **no secrets**. Bring your `.env.local` separately.

> **📌 2026-10-18 — business decisions:** see `docs/strategy/2026-10-18-business-model-and-v1-gate.md`
> (sales channels, accountant seats, Vault as an operator-only toggle, Toast partner findings,
> bulk-upload workaround). It changes no code. V1 / A6 is still the gate — see the 2026-10-18
> RESUME block below.

## Resume a session

**Paste this into a fresh session to resume (laptop / next session):**

```text
Pull latest main. Read, in order: CLAUDE.md, docs/PRODUCT-MAP.md,
docs/strategy/2026-10-18-business-model-and-v1-gate.md, then docs/SESSION-HANDOFF.md.
Start from the ⏱️ RESUME HERE — 2026-10-18 block (authoritative; every older dated block,
including both 2026-07-04 blocks, is history). The app is live on www.outfrontdata.com and
main auto-deploys on merge — work on a branch, open a PR, never merge to main yourself.

OutFront Data is the business; Spirit Vault is an operator-only toggle module. Nothing ships
to outside operators until V1 runs clean on Stone Grille (bar: Stone reconciles clean for 7
consecutive days with no manual intervention). Do NOT start billing / channel / Vault-toggle /
Toast-partner build work until that gate is met.

Sean decided (10-18): the pre-cutover backlog (July's 373) doesn't count — start fresh. V1 is
measured from a cutover date forward; nothing is deleted. The live path:
  1. Pick the cutover date (first day that counts).
  2. Each morning after the syncs, check the streak:
     npx dotenv -e .env.local -o -- tsx scripts/recon-health.ts --tenant <stone-slug> --since <cutover>
     (first time: run scripts/summarize-sync-exceptions.ts with no arg to see Stone's slug)
  3. A DIRTY day names its cause: pending review → clear only post-cutover rows on
     /settings/sources/review; then fix the rule so it doesn't recur and run
     scripts/reapply-rules.ts --tenant <slug> (dry run, then --commit). Hand-decided rows make
     that day dirty by definition — the fix is a rule, not more clicking.
  4. 7 CLEAN days in a row = the V1 reconciliation bar.

Don't touch Codex-lane PRs (codex/* heads, #170 especially — it's a one-time demo→prod copy).
CLI steps need Sean's local .env.local; the review-page clearing does not.
```

> **⚠️ Historical note (2026-06-12/13).** The **2026-10-18** block at the top is now authoritative; every
> dated block below it (2026-06-15, 2026-06-13, …) is history, kept only for context. The 10 live tiles +
> Toast era integration (this doc's "Where we are")
> and the Allocation engine + Vercel deploy (the RESUME block) are BOTH on `main`. **PR #18 is MERGED** and
> **Toast operational scopes are now GRANTED** (orders/cashmgmt/labor) — the era + operational APIs run on
> TWO separate credential sets (see below).

Repo: **https://github.com/seanaustin1-rgb/restaurant-os** (private)

---

## ⏱️ RESUME HERE — 2026-10-18 — STATE RECONSTRUCTED · V1 GATE ON STONE IS THE ONLY PRIORITY

**`main` tip: `aca6546`** (#173, strategy doc). This block was rebuilt from `git log`, the GitHub
PR list and the repo on 2026-10-18 — the 07-04 handoff had gone stale across ~100 commits.
**Verified** = read from the repo/GitHub this session. **Inferred** = labelled as such.

### What shipped since 2026-07-04 (verified, `git log origin/main --since=2026-07-04`)
- **OutFront core / Profit First (07-04 → 07-13):** the 07-04 EOD wave (#85–#88, #94, #95, #97,
  #98) plus **#107** accrued-vs-cleared tax drift signal (Codex lane; supersedes #90, which was
  **closed unmerged**), **#108** B6 cash floor + sweep safety, **#109** B7 inferred payroll
  forward accrual, **#110** Forward Cash threads `db` so demo never hits prod. Onboarding: #92,
  #96, #99, #101.
- **Real-estate / Raven demo (07-05 → 07-14):** #104 public RE cockpit demo, #111/#112 merged then
  **reverted by #114** (approval gate, DECISION-004), #115 July-14 demo, #116–#119 demo polish.
- **Spirit Vault (07-26 → 08-19):** static Brag Book batches #122–#136 (whiskey shelf complete),
  **#137** canonical schema + migration, **#139** importer and **#140** Middle West →
  Ported Pumpernickel Rye (both **merged 07-30**), **#142** admin editor + dynamic `/vault`, #144
  public payload hardening, **#143/#147–#149/#160** Flight Builder, **#150/#152** daily presence
  gate + vault-code card, **#153–#158** membership spine/UI/opt-in/hardening.
- **Team Hub (10-03 → 10-07):** #165 recon, #166 Spec F (`docs/fable-5/SPEC-F-team-hub.md`),
  **#167** tenant-scoped foundation (+ migration), **#169** roster + phone membership, **#171**
  Stream media pipeline, **#172** lesson publishing + feed (`/team`).
- **Other:** #164 ECC plugin at project scope (09-26); #173 strategy doc (10-18).
- **Nothing since 07-13 touched sync, categorization, the ledger, or reconciliation.** The V1
  gate has not moved in three months.

### Migrations added to `main` since 07-04 (verified files; prod-applied status NOT verifiable here)
`20260704033000_add_restaurant_tax_profile` (#107) · `20260713010000_add_restaurant_cash_floor`
(#108) · `20260728000000_add_spirit_vault` · `20260809000000_add_spirit_flights` ·
`20260810000000_add_flight_item_pairing_bites` · `20260818210000_add_membership_spine` ·
`20260819120000_add_member_marketing_optin` · `20260819130000_membership_redemption_tenant_fk` ·
`20261003153000_team_hub_foundation`. `npm run build` is `prisma generate && next build` — it does
**not** run `migrate deploy`, so every one of these was (or still is) an operator apply.
*Inferred:* the live app reads `taxProfile`/`cashFloor`/vault/team tables, so they're probably
applied — confirm with `npx dotenv -e .env.local -o -- prisma migrate status`.

### Open PRs (verified 2026-10-18) — lane and status
| PR | Head | Lane | Status / call |
|---|---|---|---|
| #170 | `codex/copy-spirits-demo-to-prod` | Codex | Ready. One-time demo→**prod** data copy. Codex lane — don't touch; Sean decides. |
| #168 | `docs/spec-f-roster-sync` | Team Hub docs | Ready. Toast roster-sync spec. Not V1. |
| #163 | `codex/flight-builder-availability-hardening` | Codex | Draft, stale since 09-05 (`codex/flight-builder-163-plus-162` also exists). |
| #162 | `claude/spirit-vault-flight-builder-x71qai` | Claude/Vault | Draft, stranded since 08-25 — Flight Builder already on main via #143/#160; likely superseded. |
| #161 | `docs/next-session-handoff` | Vault docs | Ready, stranded 08-19 ("Claude owns whole build"). |
| #159 | `codex/spirit-vault-flight-builder-plan` | Codex | Draft plan, stranded. |
| #151 | `docs/phase2-guest-layer-spec-v2` | Vault docs | Ready, stranded 08-18. |
| #146 | `claude/previous-session-continuation-ls0rka` | Claude/Vault | Draft — Sean's answers to 7 Vault audit questions; stranded. |
| #145 | `feat/spirit-vault-draft-loader` | Vault | Ready — hidden draft inventory; stranded. |
| #138 | `agent/spirit-vault-doc-sync` | Codex | Draft doc refresh; superseded by later merges. |
| #121 | `seanaustin1-rgb-patch-1` | Sean | Gemini CLI step in Codex Review workflow. |
| #120 | `claude/continue-previous-session-0wiffu` | Claude/Raven demo | Draft, stranded since 07-27. |
| #113 | `claude/stuck-last-session-9fbzxf` | Claude/CI | Draft: silence Codex-review spam. |
| #106 | `work` | Codex/Raven | Draft: Morning Ritual. Stranded. |
| #105 | `codex/prepare-for-luke-pilot-execution` | Codex/Raven | Owner Morning Brief. Stranded. |
| #103 | `claude/a6-operator-laptop-run-9j934q` | Claude/RE | Draft: B6 (now **superseded by #108**) + RE lead-pipeline schema, auto-migrate-on-deploy commit; 2 gated migrations. Stranded. |
| #91 | `feat/ledger-bucket-map` | Codex | Draft: one TapBucket↔LedgerAccount map — **this is Spec A.3's prerequisite**. Stranded since 07-04. |
| #63, #53 | `claude/executive-cockpit-design-jtkpse`, `claude/brokerage-loader-dedup` | Claude/brokerage | Drafts, stranded since 07-02. |

**`claude/rule-guardrails-and-triage`** = **PR #77, MERGED 07-04** (squash). The branch still
exists but carries 0 patches not in main — safe to delete. `claude/stone-triage-execute` still
has 2 unmerged patches (unreviewed; not a PR). ~110 remote branches total — pruning is overdue.

### Spirit Vault vs `docs/spirit-vault/HANDOFF.md` (verified)
- #139 and #140 **are merged** (07-30). That doc's top block (07-30) still lists them as open —
  it's stale and also predates #142–#160. Refresh it when Vault work resumes (after V1).
- **Bottles held for identity confirmation: none open as of the doc's last update.** Middle West
  was the last hold (resolved by #140). **Calumet is a Sean "off" decision, kept as draft — not a
  hold.** *Not verified:* anything held in the DB-backed admin (`/vault` admin, post-#142) — the
  doc doesn't track it; check the admin's draft list before saying zero.

### ⛔ THE GATE — V1 on Stone (fresh start from a cutover date — Sean, 10-18)
Bar: **Stone reconciles clean for 7 consecutive days with no manual intervention**, counted
from the cutover. Measured by `scripts/recon-health.ts` (see the audit section below).
1. **Pick the cutover date.** Pre-cutover exceptions (July: 373) are ignored, not cleared.
2. **Clean-day check — BUILT** (`recon-health.ts`, PR `claude/v1-ops-readiness`). Read-only;
   recomputed each run, not persisted. Persisting a daily record can come later if needed.
3. **Parity:** only required on clean days (per-day `spinesConverged`, 1% / $1). Whole-month
   `compare-spines` over pre-cutover data will still drift; ignore it.
4. **Real-data spot-check** of Tax Vault / Cash Flow / Spending / Forward Cash once the streak starts.
5. **Overnight re-accumulation check** — after a clear, the next fan-out should add single
   digits. If not, a rule gap exists — fix the rule, then re-apply it to existing rows.
   Re-apply tool: **`scripts/reapply-rules.ts --tenant <slug>`** (dry run; add `--commit`) —
   current rules → bank-fed non-override rows → ledger re-mirror, exact-slug/unambiguous tenant
   resolve. Rows already decided on the review page are **held** and listed, never re-mirrored
   over. Shipped in **PR #175** (replaces `recategorize-transactions.ts`, deleted in #33); not
   yet run against prod. Don't use `reapply-categorization-ledger.ts` for this — it only fills
   UNCATEGORIZED / confidence ≤ 0 rows.

**Then (post-gate, strategy doc "Order of work"):** bottle matching → Vault entitlement toggle +
walled-off guest endpoint → bulk-upload export + photo → card → Toast partner application.
*Not in the strategy order (ledger-track debt, sequence with Sean):* #91 bucket map → A.3
allocation port onto the ledger.

### Ops-readiness audit (2026-10-18 afternoon) — beyond exception clearing
- **FIXED (PR `claude/v1-ops-readiness`):** the nightly Plaid sync re-mirrored every added *and
  modified* txn, and `mirrorBankTransactionToLedger` rebuilt the ledger event from scratch —
  so a review-page approval/exclusion was wiped and its exception reopened whenever Plaid
  re-sent the txn (pending→posted, merchant enrichment). The mirror now keeps a human/script
  decision (`approvedBy` set, or EXCLUDED) while amount + date are unchanged.
- **FIXED (same PR):** `reapply-categorization-ledger.ts` wrote by default; now needs `--commit`.
- **DECIDED (Sean, 10-18): the pre-cutover backlog doesn't count — start fresh.** The July 373
  (and anything else dated before cutover) is history; V1 is measured only from a cutover date
  forward. Nothing gets deleted. Consequence: legacy↔ledger write-back is **not** needed for the
  gate. Any row a person has to decide already makes its day dirty, so parity only has to hold on
  untouched days, where both spines come from the same `categorize()` guess. Historical
  `compare-spines` over pre-cutover months will still show drift; ignore it.
- **BUILT (same PR): `scripts/recon-health.ts --tenant <slug> --since <cutover>`** — read-only,
  per-day CLEAN/DIRTY + current streak (target 7). Clean day = no bank events pending review,
  none hand-decided, legacy/ledger agree for the day (`spinesConverged`), and Toast has a
  `DailySales` row for the business day. Also prints Plaid `lastSyncedAt` freshness. Logic in
  `src/lib/financial-ledger/recon-health.ts` (tested); parity math now shared via
  `legacySpineTotals`/`ledgerSpineTotals` in `spine-compare.ts` (compare-spines uses them too).
  Bank rows post late, so a past day can flip to DIRTY when a straggler lands; recomputed each run.
- Pending (pre-post) Plaid txns come back as remove+add with a new id, so any decision on a
  *pending* row is lost by design. Review posted rows only.

### Operator reminders (Sean does these)
- Confirm the previously exposed GitHub PAT is **revoked**.
- Toast Partner Connect application status.
- `prisma migrate status` against prod — confirm the 9 migrations above are applied.

---

## ⏱️ RESUME HERE — 2026-07-04 (EOD) — SPEC A + DEMO READ MODULES SHIPPED · A6 IS THE GATE [HISTORY — superseded by the 2026-10-18 block above]

**`main` tip: `a5db4c1`** (this lane's last merge was **#98 `4077094`** A10; `#96`/`#99` on top are a
separate onboarding lane — industry deep links + source planning). Everything in the older 2026-07-04 block
below is now history — the "Tax Vault is next" work is all merged. Auto-deploys to **www.outfrontdata.com** on merge.

**✅ Merged today (all squash, each re-verified green Typecheck/Test/Build + Codex advisory):**
- **A.1 Tax Vault** ledger-first read + source-trust (`src/lib/modules/tax-vault.ts`) — #85
- **A.2 Cash Flow** ledger-first (`cash-flow.ts`) — #86 · **A.2 Spending** ledger-first + category map (`spending-by-category.ts`) — #87 · **A.2 coverage-gap signal** (`signals.ts` `deriveCoverageGap`) — #88
- **A8 — Forward Cash** (`src/lib/modules/forward-cash.ts` + module/page/tile) — #94. 30-day event-based projection; surfaces the LOW-POINT (payroll + recurring + 10th/25th sweeps). Read-only; honest when unanchored.
- **A9 — Daily Digest** (`src/lib/modules/daily-digest.ts` pure builder + `src/lib/email/daily-digest.ts` + `digest-recipients.ts` + Inngest `dailyDigestScheduler`/`sendDailyDigest` in `functions.ts`) — #95. Deterministic content from `signals.ts` + Forward Cash low-point. **External send HARD-GATED behind `DAILY_DIGEST_ENABLED=true` AND `RESEND_API_KEY`** — off until the operator opts in. Recipients = each tenant's OPERATOR → Clerk primary email.
- **A5 — Spec C review bulk triage** (`/settings/sources/review`: `ReviewControls.tsx`, `actions.ts`, `review.ts`) — #97. Per-row approve-as-category (default = rule-engine guess) through the one `ledgerMappingForTap`; save-as-rule through the `keywordPatternProblem` guardrail; **bulk approve-all-as-category / exclude-all per vendor-signature group** (transactional, >10 confirm, requires an explicit category — never blanket-confirms low-confidence guesses). This is the tooling that makes A6 a ~10-min job.
- **A10 — Brokerage taxonomy + vendor seed pack** (`categories.ts` `BROKERAGE_CATEGORIES`, `brokerage-seeds.ts`, `ruleSeedsFor`/`categoriesFor` businessType routing) — #98. Restaurant path is byte-identical. Codex caught + I fixed a real gap: `revenueCategoryId(tapById)` so brokerage commission inflows classify instead of dropping to null (`categorize()` no longer keys revenue off the hardcoded "Sales Deposits" name).

**⛔ THE GATE — A6, an OPERATOR/LAPTOP action (not code). This is the live critical path:**
1. `/settings/sources/review` on **Stone Grille** → use the new **bulk "Approve all as [category]" / "Exclude all"** on the largest vendor groups to clear the **373** open sync exceptions. Run `scripts/summarize-sync-exceptions.ts stone` **before and after** — that delta is a demo asset. (Runbook: `docs/fable-5/RUNBOOK-stone-triage.md`.)
2. Clearing Stone unblocks: real-data spot-check of **Tax Vault / Cash Flow / Spending / Forward Cash** (they read ledger-first only where coverage exists — safe today, but unverified against real ledger data until Stone is clean), and **`scripts/compare-spines.ts "Stone Grille"`** parity (the acceptance gate before A.3 touches allocation math).
3. **A10 demo verify:** `npm run seed:brokerage -- --user <clerkUserId>` against the demo DB → confirm "Cascade Realty Group" tiles read brokerage-native.

**🤝 Codex lane (separate agent, do NOT step on):**
- **PR #90** — A.1 accrued-vs-cleared reconciliation + `tax-sales-drift` signal. Adds a **`Restaurant.taxProfile` migration** → **migration must be applied by the operator before merge/deploy** (whole-dashboard blast radius: `loadTaxVault` feeds `loadDashboardData`). Also awaiting Codex to add the requested **`cleared==0` → insufficient-data guard** (avoid a 100%-variance red false-positive on a pre-triage tenant). `CODEX_HANDOFF.md` has the brief.
- `brokerage-analytics.ts` + `signals.ts` are shared/Codex-touched — coordinate.

**Open PRs (all other-lane drafts — not this lane's to land):** #90 (Codex reconciliation, migration-gated), #91 (ledger bucket-map), #63, #53.

**Non-negotiables (from CLAUDE.md):** two spines, ledger-first-with-legacy-fallback (Cash Oxygen pattern), never a 3rd path · categorization only through `categorize()`/`rules.ts` · rule edits don't retro-move rows (run `recategorize-transactions.ts --commit`) · KEYWORD guardrails stay (word-start match + stopword reject) · signals stay deterministic · demo writes only ever hit `DEMO_DATABASE_URL` · never run a prod migration (operator action) · Investor role read-only.

**Next candidates after A6:** A11 (rehearse investor-demo-script) · B-bucket is mostly launch-gated (B3 allocation is GATED on compare-spines output; B6 cash-floor/sweep-safety is cheap after A8; B7 payroll forward accrual feeds A8).

---

## ⏱️ RESUME HERE — 2026-07-04 (SPEC A FOUNDATION MERGED · TAX VAULT IS NEXT) [HISTORY — superseded by the EOD block above]

**Active thread: Spec A — ledger convergence.** Converge dashboard modules off the legacy
`Transaction → TapBucket` spine onto the clean ledger (`RawSourceEvent → NormalizedFinancialEvent →
LedgerEntry`), **ledger-first with legacy fallback**, the pattern Cash Oxygen established. See
`docs/fable-5/spec-a1-tax-vault.md` and `spec-a2-cashflow-spending.md` (authoritative), and the
`MASTER-ROADMAP-2026-07-03.md`.

**✅ Merged to `main` today (all squash-merged, each re-verified green — Typecheck/Test/Build + Codex):**
- **#83 — `src/lib/financial-ledger/ledger-coverage.ts`** — the Spec A **linchpin**. Reusable ledger-first /
  legacy-fallback decision: `pickReadSource` (pure), `assessLedgerCoverage(db, restaurantId, {accounts,
  windowDays, asOf})`, `describeLedgerSource` (source-trust caption). Extracted so Tax Vault (A.1) and Cash
  Flow / Spending (A.2) inherit ONE coverage heuristic instead of copying Cash Oxygen's narrow `hasFixedBurn`.
  Default window anchors on the **later** of latest ledger/legacy dates (a Codex-caught fix — a stale ledger
  with newer legacy txns must not falsely read "ledger"). Fully unit-tested with a fake DB (11 tests).
- **#82 — `spine-compare.ts` + `scripts/compare-spines.ts`** — **Spec A.2 Feature 3 already done ahead of
  order**: the cross-spine parity acceptance instrument. Read-only; totals each canonical bucket from both
  spines for a tenant+period and prints deltas. `npx dotenv -e .env.local -o -- tsx scripts/compare-spines.ts
  "Stone Grille"`. When deltas are ~0 across a trailing month the spines have converged and legacy deletion
  becomes safe to schedule.
- **#81** — brokerage CRM copy fixes (BoldTrail→CRM genericization, appFiles→AppFiles). Closes July-3 QA #2/#3.

**These are foundation/tooling only — no live module wired yet, no schema/migration, no runtime behavior
change.** They're the tested primitives Spec A execution consumes next.

**⛔ HARD GATE for A.1 to *ship/verify* against real data — Stone's SyncExceptions must be ~0.** This is an
operator action; the code build below does NOT need it (fallback is the default, so ledger-first only engages
where coverage exists). Two ways to clear Stone, operator's choice:
- **App UI (no secrets needed):** `/settings/sources/review` — same `review.ts` approve/exclude the CLI uses,
  grouped for batch clearing. This is the recommended path when working without a local `.env.local`.
- **CLI (needs prod `DATABASE_URL`):** dry-run first, then `--execute`. See `docs/fable-5/RUNBOOK-stone-triage.md`.
  `scripts/triage-exceptions.ts` only auto-clears a positive current-rules match; revenue re-class and excludes
  are never auto-applied; ambiguous rows stay `PENDING_REVIEW`. `scripts/summarize-sync-exceptions.ts stone`
  gives the pre-triage picture.

**⏭️ NEXT — Spec A execution, code-only and mobile-reviewable (each a small PR, Codex-reviewed):**
1. **A.1 Tax Vault ledger-first read + source-trust indicator** (spec-a1 Features 1 & 4) — wire
   `assessLedgerCoverage` into `src/lib/modules/tax-vault.ts`; render `describeLedgerSource`. Pure code +
   fixtures; safe to merge (fallback default). *Real-data spot-check waits on the Stone gate above.*
2. **A.1 accrued-vs-cleared reconciliation + drift signal** (Features 2 & 3) — accrued (Toast per-check tax)
   vs cleared (DAVO pulls in ledger); >5%/30-day drift → `signals.ts`. Needs a per-tenant tax-profile field
   (schema change → migration is an **operator-apply** step; build + review here, coordinate the apply).
3. **A.2 Cash Flow ledger-first read** (spec-a2 F1) — wire the shared util into `cash-flow.ts`. If the util
   needs changing to fit, STOP — A.1's extraction was too narrow. Pure code.
4. **A.2 Spending ledger-first read + explicit category-mapping table** (F2) — no silent coercion; unmappable
   → "Unmapped" with a count. Pure code + mapping-completeness tests.
5. **A.2 coverage-gap signal** (F4) — low-priority `signals.ts` signal when fallback engages for a gap window;
   silent for tenants with no ledger source at all. Pure code.

Constraints for all of the above (from the specs): **read-path only, no writes, no sync/allocation changes,
legacy path stays intact and reachable, full Vitest suite green.**

---

## ⏱️ RESUME HERE — 2026-06-15 (LIVE ON BRANDED DOMAIN + AUTO-SYNC RUNNING)

**Live on the brand domain: https://www.outfrontdata.com** (apex 308→www, SSL/HSTS issued; Bluehost DNS:
apex A→`216.198.79.1`, `www` CNAME→Vercel; same Vercel project `restaurant-os` — the
`restaurant-os-hazel.vercel.app` URL still works too). Sign in as the OPERATOR (OTP `424242`) as before.

**✅ Inngest PRODUCTION auto-sync — DONE.** Registered the prod app with Inngest Cloud by `PUT`-ing the serve
endpoint (`PUT https://www.outfrontdata.com/api/inngest` → `{"Successfully registered"}`); verified at the
source via the Inngest API audit log. Event + signing keys are in Vercel (confirmed: prod serves in cloud
mode). **4 functions + 2 crons live:** `dailyPlaidSyncScheduler` (6:00am ET) + `syncPlaidConnection`,
`dailyToastSyncScheduler` (5:30am ET) + `syncToastMetrics` (which also runs sales-mix, sales-tax, menu-items,
and the Profit First ledger). Inngest serve URL is pointed at the branded domain. To re-sync after a deploy
that changes functions: `curl -X PUT https://www.outfrontdata.com/api/inngest`.

**✅ Operator gates from the 06-13 block — ALL CLEARED:** the 6 `TOAST_*` vars ARE in Vercel; a Plaid bank
is attached and pulling in prod; **both backfills ran** (`sync-toast-sales-tax.ts 21` → 21 days of sales tax;
`run-allocation-ledger.ts` → seeded ledger/balances).

**✅ LABOR TILE BUG — ROOT-CAUSED + FIXED + SHIPPED (`416c8e3`, pushed → deployed).** Symptom: Labor read
0%/$0 for June MTD while COGS/OpEx had spend. **Two causes:** (1) over-broad operator KEYWORD rules
(`/TOAST/`→Payroll Tax, then `/payroll/`→Sales Deposits) at priority 5 outran the system rules and dumped the
Toast payroll **wages** (~$17.7k that should be LABOR) into excluded buckets; (2) `plaid/sync.ts` had no
sign-based REVENUE handling (only ran vendor rules), unlike the import route — so bank **deposits** matched
expense rules. **Fix:** extracted one shared `categorize()` into `src/lib/categorization/rules.ts`
(amount<0 → REVENUE by sign, else vendor rules → Misc) and wired BOTH the Plaid sync and the statement-import
commit route through it. Operator then disabled the bad rules in `/settings/rules` and ran the recategorize.
**Verified: June Labor now $17,702.99 (~31%, under the 32% target), payroll tax split to TAX_PAYROLL,
deposits in REVENUE.** New script: `scripts/recategorize-transactions.ts` (dry-run default, `--commit`;
scopes to bank-fed `plaidConnectionId!=null` + non-override; batched `$transaction`).

**⚠️ OPEN — broad keyword-rule hazard.** The rules UI / setup wizard generated **single-word KEYWORD rules
that substring-match anything**: `THE`→Smallwares, `ACE`→Beer (sp**ace**/pl**ace**), `EVER`→Beer
(n**ever**/how**ever**), `OVER`→Revenue (disc**over**y); `TOAST` and `payroll` are now disabled. These will
silently miscategorize. **Recommend:** audit what each broad rule currently catches and disable the dangerous
ones (specific vendor patterns like WILSBACH/PLCB/PERFORMANCEMD are fine). Likely a **setup-wizard quality
bug** (it should emit specific patterns, never single tokens, and never map `payroll`→Revenue) — worth fixing
at the source. **Remember: editing a rule does NOT move existing rows — re-run `recategorize-transactions.ts
--commit` after any rule change** (the next nightly Plaid sync also re-applies, but the script fixes data now).

**⏭️ NEXT (the one open task) — LOGO swap.** Operator will drop a new site logo. Requirements:
- Save as **`public/logo.png`**, and it MUST be a **true-transparent RGBA PNG**. The file the operator first
  added (`public/Logo_trans.png`, still there, 902KB, **unused — safe to delete**) was opaque 24-bit RGB with
  a near-white/checkerboard background baked in → would render as a pale box on the dark header. Trimming
  alone doesn't fix that; it needs real alpha transparency. (If a flattened file comes in again, it can be
  background-keyed with .NET/`System.Drawing` — near-white > min-channel ~230 → transparent — but a proper
  transparent export is better.)
- All four references already point at `/logo.png` (`AppHeader.tsx`, `dashboard/DashboardHeader.tsx`,
  `app/page.tsx`, `app/privacy/page.tsx`, each `<img … h-N w-auto>`), so **no code change** — just replace the
  file, then `git add public/logo.png && git commit -m "Update site logo" && git push` to deploy site-wide.

---

## ⏱️ RESUME HERE — 2026-06-13 (LIVE ON VERCEL)

**The app is deployed and working in production:** **https://restaurant-os-hazel.vercel.app**
(Vercel project `restaurant-os`, Hobby plan, auto-deploys on every push to `main`.)
To just USE/demo it: open that URL in any browser, **Sign in** (not Sign up) as the
OPERATOR who owns Stone Grille — `clerkUserId user_3EYUw6yNiDgTiBoorH0c9GuLPR2`; its
email is in the Clerk dashboard → Users (a `+clerk_test@…` address); OTP `424242`.

**Shipped to `main` since the engine work:** Allocation & Variance engine (core +
live `/modules/allocation` view, PR #17), TAP editor `/settings/allocation` + 3-way
COGS drill-down (PR #16), software-vendors→Technology categorization fix (`c664d5a`),
`DEPLOY.md` (Vercel + Bluehost-domain steps), **PR #18 Debt Service → Profit (`8212ce3`)**.
All build clean.

**Backlog cleared 2026-06-13 (all on `main` except the wizard):**
- **Tax Vault + Sales-Tax skim** (`/modules/tax-vault`) — collected sales tax from the Toast
  Orders API (per-check taxAmount), reserve OK/SHORT; allocation view Tax Reserve uses it.
- **Allocation production phase** — persisted bucket ledger (`BucketAllocation` + recomputed
  `VirtualAccount` balances + `BucketSweep` 10th/25th sweeps), daily Inngest run; allocation view
  shows balances + sweeps. `src/lib/profit-first/ledger.ts`. Obligation/reconciliation sub-tables
  deferred (no integration feeds).
- **Health-status vocabulary unified** (defined once; usage thresholds named).
- **Category Trends & Budgets** (`/modules/category-trends`) — MoM 6-month bars + per-category
  monthly budgets (`Category.monthlyBudget`) + budget-vs-actual.
- **Setup wizard** (`/onboarding/vendors`) — top vendors by spend → confirm category → seeds
  per-tenant KEYWORD rule + recategorizes. **On `main` (`ec2efea`).**
- Migrations applied this session: `add_daily_sales_tax`, `allocation_ledger`, `category_budget`
  (**15 total now**). **Operator-run backfills still pending**: `scripts/sync-toast-sales-tax.ts 21`
  + `scripts/run-allocation-ledger.ts` (prod-DB writes — run in your own terminal).

**✅ TOAST OPERATIONAL ACCESS GRANTED 2026-06-13 — dual-credential connector shipped (`04a1be8`).**
The operator created a **Standard API** credential set in the Toast portal (the existing "Deep dive"
set is Analytics-only / `reporting-api-onboarding`; Analytics vs Standard scopes live on SEPARATE API
clients — one client can't hold both). Scope probe now **200 on all 8 operational endpoints**
(orders, cashmgmt, labor.employees/jobs/timeEntries, config menus/diningOptions, restaurants).
- **Connector now reads TWO credential sets** (`src/lib/integrations/toast/{config,auth,analytics}.ts`):
  base `TOAST_CLIENT_ID/SECRET` = **Standard/operational**; new optional
  `TOAST_ANALYTICS_CLIENT_ID/SECRET` = **Analytics (era)**. `config.getToastAnalyticsCredentials()`
  falls back to the base creds when the analytics vars are unset (single-set deployments unaffected);
  `auth.ts` caches tokens per-clientId so both sets coexist; `analytics.ts` era auth uses the analytics
  set. Verified live: operational 200s + era metrics returning real Stone Grille data. tsc + build clean.
- **`.env.local` now has all 6 Toast vars** (4 base + 2 analytics). `.env.example` documents the 2 new ones.

**OPERATOR ACTIONS NOW (next) — all operator-side; everything buildable is built:**
1. **Add the 6 Toast vars to Vercel** (Project → Settings → Environment Variables, **Production +
   Preview**) so the live daily Inngest sync + any live Toast reads work in prod:
   `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`, `TOAST_ANALYTICS_CLIENT_ID`, `TOAST_ANALYTICS_CLIENT_SECRET`,
   `TOAST_API_HOSTNAME`, `TOAST_RESTAURANT_GUID` (same values as `.env.local`). Vercel-dashboard action.
2. **Run the two prod-DB backfills** in your own terminal (prod-DB writes are hard-blocked from inside
   Claude Code): `npx dotenv -e .env.local -- tsx scripts/sync-toast-sales-tax.ts 21` (backfills 21 days of
   collected sales tax for the Tax Vault tile) + `npx dotenv -e .env.local -- tsx scripts/run-allocation-ledger.ts`
   (seeds the persisted bucket ledger + sweeps).

**✅ DONE 2026-06-13 (was operator-action #2 — the live Sales-Tax skim):** BUILT & shipped (`41f6b7e`).
Reads Toast's collected sales tax via the Orders API (`/orders/v2/ordersBulk`, per-check `taxAmount`,
voids/deletes excluded) for the pre-allocation skim + **Tax Vault tile** (`/modules/tax-vault`, spec §C3.3).
`src/lib/integrations/toast/orders.ts` + `sync.ts`, daily Inngest wired, migration `add_daily_sales_tax`.
Typecheck clean. This was THE thing gated on the scope grant — gate cleared. **PR #1 (old rule-suggestions)
CLOSED 2026-06-13 as superseded** (feature shipped via `4af86f3` Phase 3).

**✅ DONE 2026-06-13 (the former gate 2 — all landed):**
   - **PR #18 Debt Service → Profit — MERGED** (`8212ce3`, squash, branch deleted).
     Migration `20260613120000_add_profit_tap_bucket` **applied to live Supabase**
     (12 migrations now); `scripts/fix-debt-service-bucket.ts` flipped the existing
     "Debt Service" Category `tapBucket` OPEX→PROFIT on all 3 restaurants (committed to
     `main`, `8f591a0`). Debt Service now draws against the Profit gauge.
   - **Tech fix — applied:** `fix-tech-categorization.ts --commit` moved 4 Stone Grille
     txns ($1,671.60) + Sandbox/Demo rules Smallwares→Technology. OPEX total unchanged
     ($61,170.12) — drill-down only.
   - **Classifier note for next session:** prod-DB script writes (`tsx scripts/*.ts --commit`)
     are HARD-blocked from inside Claude Code and a broad `Bash(npx dotenv:*)` allow rule
     is itself rejected (arbitrary `--` passthrough). The reliable path is the **operator
     runs the script in their own PowerShell** (see the npx execution-policy gotcha in
     "Loose ends"). Migrations via `prisma migrate deploy` and merges-to-main DO go through
     after an explicit in-conversation "go".

**Backlog — CLEARED 2026-06-13** (persisted bucket-ledger + sweeps, setup wizard, health-status
unify, category trends/budgets, Tax Vault — all built; see "Backlog cleared" list above). Remaining
deferred: the obligation/reconciliation sub-tables + MarginEdge/Davo pull-clear event handlers (need
integration feeds that don't exist yet); **scheduled-vs-actual labor** (Toast `/labor/v1/shifts` works
but the schedule is sparse until Sling fully publishes into Toast — operator-side fix). Operator gates
still open: 6 Toast vars → Vercel, the two backfills. (PR #1 closed 2026-06-13.)

### To continue dev work on another machine / Claude Code web
1. Clone the repo (everything's on GitHub, incl. the in-flight branch).
2. **Bring `.env.local` securely** — it's the ONLY thing not in the repo (DB password
   + all keys). Without it, local scripts/builds won't run, but editing + pushing
   (which auto-deploys via Vercel) works fine.
3. `npm install` → `npx prisma generate` → `npm run dev`. DB is shared (Supabase), no
   migration needed to develop (all 12 migrations applied, incl. the debt-service one).
4. Project memory lives in the local `~/.claude` config and may NOT travel to a new
   machine — **this doc is the source of truth.**

---

## What this is
Multi-tenant restaurant-operator SaaS with a **Profit First** cash layer. Next.js 14 · Supabase/Prisma · Clerk · Plaid · Inngest · Vercel. Customer Zero = Stone Grille & Taphouse.

## Where we are (done & working)
- **✅ 10 DASHBOARD TILES LIVE + the Allocation engine + deployed to Vercel (as of 2026-06-13).** Live tiles:
  Cash Flow · Vendor Spend · Spending by Category · **Recurring & Subscriptions** · **Cash Runway** ·
  **Payment Watch** (bank-data) + **Covers Flow** · **Labor Hours** · **Sales Mix** · **Menu Engineering**
  (Toast `era` analytics). Allocation & Variance engine at `/modules/allocation` (+ `/settings/allocation`).
  Daily 5:30am ET Inngest sync refreshes Toast metrics/mix/menu-items. Details for each are below.
- **Tier-3 AI bank-statement import is LIVE**: scanned PDF → Claude structured extraction → categorized transactions → Profit First dashboard. Real May data imported to restaurant **"Stone Grille and Tap House"** (`cmpvtkou90000syl9ziir8nlj`), 282 txns; 28 days of seeded sales so the gauges compute.
- **Categorization v2 — Phase 1 mostly built & shipped:**
  - **Two-level model live**: `Category` (per-restaurant, operator-extensible) → fixed `TapBucket` enum. `Transaction.categoryId` added; legacy `bucket` kept (dual-write).
  - 26 default categories seeded per restaurant; all 282 txns backfilled (manual edits preserved); new imports dual-write `categoryId`.
  - **Dashboard rollup** now computes TAP gauges from categories.
  - **Categories settings screen** at `/settings/categories` — add / rename / remap-TAP / archive (CRUD, auth-guarded, archive blocked while a category has txns).
- **Per-restaurant rules engine — shipped** (`Rule` table; new imports self-categorize per tenant). Phase 3 added **suggested rules** from repeated manual categorizations.
- **Global app header** — nav appears on every page.
- **Dashboard Modules framework (`src/lib/modules.ts`)** — the honest registry that replaced the mock tile list. `"live"` tiles link to a real page; `"soon"` tiles render disabled with the `blockedBy` dependency that unblocks them, so **nothing on the dashboard is a fake/dead control**. The grid renders from this list.
- **Original three bank-data modules** (the established pattern every later tile follows: loader in `src/lib/modules/*.ts`, server page at `/modules/*`, client component in `src/components/modules/*`):
  - **Cash Flow** (`/modules/cash-flow`) — daily in/out, net-by-day bar chart, running balance. Sign convention: inflows stored **negative**, outflows **positive**.
  - **Vendor Spend** (`/modules/vendor-spend`) — spend by supplier, largest first, share bars; groups vendors by the same signature logic as the rules engine.
  - **Spending by Category** (`/modules/spending`) — outflows grouped into COGS / Labor / OpEx / Owner's Pay / Taxes / Other as a **profit donut** (spend groups + a profit slice = money in), plus a detailed per-category table. **Cash basis**, consistent with Cash Flow.
- **On GitHub** (private), README + specs + this handoff committed.

## Run it locally
```
git clone https://github.com/seanaustin1-rgb/restaurant-os.git
cd restaurant-os && npm install
# put your .env.local in place (NOT in the repo — bring it securely)
npx prisma generate
npm run dev          # http://localhost:3000
```
DB is already migrated on Supabase (shared) — no migration needed to develop.

## NEXT STEP — see the ⏱️ RESUME HERE block at the top (authoritative)

The two big tracks below are now **SHIPPED** (kept as a record; the RESUME-HERE block has the real
current gates):

**1. ✅ Allocation & Variance Engine — SHIPPED (PRs #16, #17).** Core + live `/modules/allocation` view +
`/settings/allocation` TAP editor + 3-way COGS drill-down. Spec: `docs/specs/allocation-variance-engine.md`.
The persisted bucket-ledger + Inngest sweeps ("production phase") remain deferred (see RESUME block backlog),
and PR #18 (Debt Service → Profit bucket) is **in flight**.

**2. ◑ Toast integration — analytics wave SHIPPED, operational wave BLOCKED.** Four `era`-analytics tiles
(Covers Flow, Labor Hours actual, Sales Mix, Menu Engineering) + daily sync are live (PRs #6–#10, detail
below). The remaining tiles (Tax Vault live skim, Food Cost, real-time orders) need the operator to grant
**operational scopes** (`orders:read`, `cashmgmt:read`, `labor.*:read`) on the Toast API client — re-probed
2026-06-13, still 403 (analytics-only creds). Scheduled-vs-actual labor still needs **Sling**.

> **✅ DONE (2026-06-12): Toast connector scaffolding built AND verified live.**
> Standalone `src/lib/integrations/toast/` module — OAuth2 client-credentials auth + process-local
> token cache (`auth.ts`), typed `toastFetch` that injects the `Toast-Restaurant-External-ID` header
> and retries once on 401 (`client.ts`), config guard `isToastConfigured()` (`config.ts`), barrel
> `index.ts`. Env contract added to `.env.example`: `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`,
> `TOAST_API_HOSTNAME`, `TOAST_RESTAURANT_GUID`. Shipped in **PR #3**. Smoke test
> `scripts/test-toast-auth.ts` + discovery `scripts/toast-list-restaurants.ts`.
>
> **Verified against PRODUCTION** (`https://ws-api.toasttab.com`) from the **local Windows machine**
> (`.env.local`, NOT a web session): ✓ config present → ✓ **OAuth2 login succeeds** (real bearer token)
> → restaurant-scoped read returns **403** = GUID + header **accepted**, but this API client's granted
> **scopes** don't yet cover `/restaurants`. So the connector plumbing is proven end-to-end; reading
> actual data just needs the relevant scope enabled on the Toast API client.
>
> **Credential facts learned (2026-06-12):** these are **Standard (restaurant-scoped) API credentials**,
> NOT a partner integration — the Partners API (`/partners/v1/restaurants`) returns
> `401 "partnerGuid must be supplied in token"`, so there's no partner restaurant-list to query; the
> restaurant GUID must be supplied directly (it's a UUID issued with the client id/secret).
> `TOAST_RESTAURANT_GUID` is a UUID (8-4-4-4-12), **not** the access-type label `TOAST_MACHINE_CLIENT`.
>
> **⚠️ CRITICAL FINDING (2026-06-12): the current creds are ANALYTICS-only, not operational.**
> Decoded the access-token claims: `iss=toast-pos.toasttab.auth0.com`, **`scope=enterprise-metrics:read`**
> — the only granted scope. So this client is provisioned for the Toast **Analytics / Enterprise Metrics
> API**, NOT Standard (operational) API Access. A scope probe of 8 operational endpoints (labor.employees,
> labor.jobs, labor.timeEntries, orders, menus, config/diningOptions, restaurants, cashmgmt) returned
> **403 on all 8** (`scripts/toast-scope-probe.ts`). The six-tile plan — especially Labor Hours
> (scheduled-vs-actual *hours*, punch/shift level) — needs **operational** scopes (`labor:read`,
> `labor.employees:read`, `orders:read`, `config:read`, `menus:read`, `cashmgmt:read`). **Decision pending
> (operator):** (A) request **Standard API Access** from Toast with those operational read scopes, and/or
> (B) build on the **enterprise-metrics** Analytics (`era`) API we already have. **Operator chose BOTH
> (2026-06-12): B now, A in parallel.**
>
> **✅ ANALYTICS API VERIFIED WORKING (2026-06-12).** `scripts/toast-analytics-probe.ts` ran the full
> async flow against `https://ws-api.toasttab.com` and pulled REAL data for Customer Zero:
> `POST /era/v1/metrics/day {startBusinessDate,endBusinessDate (same day, YYYYMMDD int), restaurantIds:[GUID],
> excludedRestaurantIds:[], groupBy:[]}` → `reportRequestGuid` → `GET /era/v1/metrics/{guid}` (note: the
> consolidated path; `/era/v1/metrics/{timeRange}/{guid}` is **410 deprecated**). timeRange `day` requires
> start==end. **Per-day fields returned:** `guestCount, ordersCount, openOrdersCount, closedOrdersCount,
> voidOrdersCount, discountOrderCount, netSalesAmount, grossSalesAmount, discountAmount, voidOrdersAmount,
> refundAmount, avgOrderValue, hourlyJobTotalHours, hourlyJobTotalPay, hourlyJobSalesPerLaborHour`.
> `groupBy` ∈ {REVENUE_CENTER, DINING_OPTION, ORDER_SOURCE}; `aggregateBy` DAY|HOUR (day only). Separate
> `POST/GET /era/v1/menu` for menu-item reporting; `/era/v1/guest/payments/{guid}` for guest data.
>
> **Tiles buildable NOW on analytics (no new Toast access):** **Covers Flow** (guestCount/ordersCount),
> **Sales Mix** (netSales + groupBy DINING_OPTION/ORDER_SOURCE/REVENUE_CENTER; menu-item via `/era/v1/menu`),
> **Labor productivity / ACTUAL hours** (hourlyJobTotalHours, hourlyJobTotalPay, salesPerLaborHour — WoW/YoY
> trend). **Still need other sources:** **scheduled** hours for true scheduled-vs-actual (Sling — analytics
> has actual only), item-level **food cost %** (Stock/inventory or MarginEdge — no cost in metrics), and any
> real-time **orders** detail. Connector note: analytics calls use `restaurantIds` in the body, NOT the
> `Toast-Restaurant-External-ID` header — add an `era`/analytics client method alongside `toastFetch`.
>
> **A (in parallel):** request **Standard API Access** from Toast for operational read scopes
> (`labor:read`, `labor.employees:read`, `orders:read`, `menus:read`, `config:read`, `stock:read`,
> `cashmgmt:read`) — reference the existing client id; do NOT paste the secret. Separately evaluate the
> **Sling** API for scheduled hours.
>
> **era client BUILT (2026-06-12):** `src/lib/integrations/toast/analytics.ts` — `runMetricsReport()`,
> `getMetricsForDay()`, `getMetricsForDays()` (per-day loop for trends; cache it), `toBusinessDate()`,
> typed `MetricsRow`. Body-based restaurantIds + async POST→poll-GET handled. Exported from the barrel;
> probe refactored to use it. In PR #3.
>
> **✅ FOUR TOAST TILES LIVE + DAILY SYNC (2026-06-12; PRs #6, #7, #8, #9, #10 — all on main).**
> Shared pattern: era → `DailySales` upsert off the render path (`toast/sync.ts`), loader reads
> `DailySales` (fast), server page + client component, tile flipped live in `modules.ts`.
> - **Covers Flow** (`/modules/covers-flow`, PR #6) — daily guests/orders/avg check. 21 real days
>   backfilled (avg 222.6 covers/day); **overwrote May seed rows** with real Toast figures.
> - **Daily Inngest sync** (PR #7) — `dailyToastSyncScheduler` (5:30am ET) → `syncToastMetrics` worker,
>   3-day lookback, idempotent; worker also refreshes the sales mix (added in #9). Single-tenant
>   resolver `resolveToastRestaurantId()` (PosConnection TOAST match → Customer-Zero fallback).
> - **Labor Hours (actual)** (`/modules/labor`, PR #8) — migration `20260612190000_add_labor_hours`
>   added nullable `DailySales.laborHours` (**applied to shared DB**). Weekly actual hours, labor $,
>   sales/labor-hour, labor %; **WoW compares the two latest FULL weeks** (partial weeks badged, never
>   read as a drop); YoY gated on real prior-year data (hidden now). Scheduled-vs-actual still parked
>   for Sling.
> - **Sales Mix** (`/modules/sales-mix`, PR #9) — migration `20260612200000_add_sales_mix` added
>   nullable JSONB `DailySales.mixByRevenueCenter` (**applied to shared DB**). Probed groupBy dims:
>   dining-option & order-source are degenerate for this operator; **revenue center is the meaningful
>   mix** (verified May 22–Jun 11, $121.8k: Dining Room 51.7 / Bar 21.1 / Patio 11.8 / Echo Reserve 8.0 /
>   To-Go 5.3 / Online 2.1%). Item/category mix needs `/era/v1/menu` — future work.
> - **Menu Engineering** (`/modules/menu-eng`, PR #10) — migration `20260612210000_add_menu_item_sales`
>   created the `MenuItemSales` table (**applied to shared DB**). `runMenuReport()` in the era client;
>   API constraints verified live: **one groupBy max, only day/week ranges**; rows per businessDate×item.
>   Weekly sync (groupBy MENU_ITEM) → popularity×revenue quadrants on median splits (NOT margin — cost
>   data unavailable; footnote says directional). Backfilled 4 weeks: 4,560 item-day rows, 445 items,
>   $162k net; top star Cheeseburger. Daily worker refreshes the current week.
>
> **Still TODO:** (a) add the four `TOAST_*` vars to **Vercel** (Prod+Preview) + **web env config** if web
> sessions need Toast — all three migrations are in the repo and apply on deploy; (b) **Food Cost** needs
> item/recipe COST data (MarginEdge has no recipe API; → Toast Stock API via Track A, or manual cost
> entry); true margin-based menu engineering unlocks with the same data; (c) Track A: Standard API Access
> request to Toast (operational scopes) + Sling for scheduled hours.

**Other bank-data modules on deck (no Toast needed):**
- ~~**Recurring & Subscriptions**~~ **SHIPPED (2026-06-12, PR #12)** — `/modules/recurring`. Groups outflows
  by `signatureOf` across full history; recurring = ≥3 hits at a steady cadence OR vendor-map `isRecurring`.
  Est/mo = cadence projection for fixed-price ("SUB", CV<0.10) vendors, **actuals pro-rated** for variable
  ones (avoids inflating mixed groups like Toast payroll+fees). Price creep only on subs (≥3 hits, ≥2%).
  Honest short-history banner (<60 days). Verified on Customer Zero: 24 recurring vendors, ~$149k/mo
  (Toast payroll $65k, PFG $35k, PLCB $11.8k…). No migration needed.
- ~~**Cash Runway**~~ **SHIPPED (2026-06-12, PR #13)** — `/modules/cash-runway`. **No balance feed exists**
  (statement import skips balance lines; no Plaid balance stored; Customer Zero has no live Plaid link) →
  operator enters a one-time **balance anchor** (balance + statement date; columns
  `Restaurant.cashBalanceAnchor/.cashBalanceAnchorDate`, migration `20260612220000`, **applied**).
  Runway = anchor + net txns since (inflows stored NEGATIVE → net = −sum), burn = 28-day avg daily net,
  green/yellow/red at >90/30–90/<30 days, area chart with 8-week projection + staleness banner.
  Math verified to the penny with a temp anchor (then cleared — **operator still needs to enter the real
  balance** at `/modules/cash-runway`).
- ~~**Duplicate / unusual payment catcher**~~ **SHIPPED (2026-06-12, PR #14) as "Payment Watch"** —
  `/modules/payment-watch`. Duplicates: "likely" (same signature + exact amount ≤3 days) and "look"
  (same amount ≥$500 ≤10 days — catches double-cashed checks, which have no vendor signature). Unusual:
  ≥3× the vendor's median (≥4 occurrences, ≥$200). No migration. **First run surfaced a real candidate
  (correctly in the "look" tier, not "likely"):** two checks — #10451 (2026-05-18) and #10465 (2026-05-26)
  — both $1,177.69, 8 days apart. NOTE: distinct check numbers, so NOT one check double-cashed; either a
  duplicate invoice paid via two checks or a legit recurring obligation — operator to confirm payee in the
  register. Checks post as bare `CHECK #N` (no payee), which is why the amount-only "look" tier exists.
  Plus 7 off-norm charges (York Water $1,000 vs usual $113, etc.).

### Categorization backlog (older — verify status before picking up)
1. **Beer/Beverage as its own dashboard gauge line** — `cogsBeverage` is computed in `src/lib/dashboard/data.ts`; may still need a gauge in the dashboard components (verify, the beverage settings/gauges work landed since).
2. **Categorization Phase 2 polish** — spend-by-category drill-down, bulk recategorize, rule-management UI. (Rules engine itself is shipped.)

**Operator decisions locked:** Misc → OpEx (until named); COGS_BEVERAGE = its own gauge line; Bank/Register Cash → EXCLUDED (register restocks); cash tip-outs → EXCLUDED, never Labor (pass-through to servers — also why some Toast deposits net low/negative).
**Still open:** rule precedence on multi-match; per-category OpEx sub-budgets; whether the beverage line gets its own target %.

## DB migrations — status (2026-06-13)
**All 12 migrations on `main` are APPLIED to the shared Supabase DB** (`prisma migrate status` =
"Database schema is up to date"), through `20260613120000_add_profit_tap_bucket`. Earlier additions:
`add_labor_hours`, `add_sales_mix`, `add_menu_item_sales`, `add_cash_balance_anchor`. The 12th
(`add_profit_tap_bucket`, PR #18) was applied via `prisma migrate deploy` when PR #18 merged — all
additive/nullable, forward-only, no `migrate dev`, no reset.

**No unapplied migrations.** New machines: `npx prisma generate` is enough to develop; the schema is current.

## ⬇️ FROM AN EARLIER (EXTERNAL) CHAT — TO INTEGRATE
> The operator has a block of notes/decisions/requests from a separate conversation
> to paste in. **Placeholder added 2026-06-12.** When provided, fold each item into
> the relevant section above (modules roadmap, locked decisions, specs) rather than
> leaving it parked here.

<!-- PASTE BLOCK BELOW -->
**Integrated 2026-06-12** → full **Profit First Allocation & Variance Engine** spec saved to
**`docs/specs/allocation-variance-engine.md`** (operator block verbatim + repo-grounding +
open-decisions). It's the real version of NEXT STEP #1. Open decisions that **conflict with
previously-locked state** (resolve before migration):
- **TAP split changes:** Labor 32→**27**, OpEx 28→**20**, new **Spill 13%** bucket. Customer Zero's
  `TapSettings` row needs a data-update (defaults only hit new rows).
- **Beer line:** earlier lock = "COGS_BEVERAGE its own gauge line"; this spec folds beer/wine into
  **COGS Liquor** (Food 18 / Liquor 12 only) for allocation. Confirm override.
- **Ledger:** extend existing `VirtualAccount` rather than add a parallel `BucketBalance`.
- **Tax source of truth:** Tax Reserve (sales) + the Tax Vault tile both use **Davo's actual pull**,
  never a 6% estimate (PA: all alcohol sales-tax exempt; 6% food + non-alc only; York County).
<!-- /PASTE BLOCK -->

## Where secrets go (so they're visible in web sessions AND in prod)
Secrets live in **three separate stores** — setting one does **not** populate the others:
1. **Claude Code web environment config** → so the agent can see them *in a web session right now*.
   Set them as environment variables/secrets on the environment this session launches from
   (docs: https://code.claude.com/docs/en/claude-code-on-the-web). They're injected into the container
   as env vars. **Currently EMPTY — this is the gap.** Whatever was added before isn't reaching this env.
2. **Vercel project env vars** → so they work *once live* (Production + Preview scopes).
3. **`.env.local`** → local dev only (never committed).
Toast vars to set in #1 and #2: `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`, `TOAST_API_HOSTNAME`,
`TOAST_RESTAURANT_GUID`. **Rotate** any key that was ever pasted into chat before going live.

**Dead ends that do NOT work (verified 2026-06-12 — don't retry):**
- **Dropping a file in `~/.claude/`.** That folder is Claude Code's *own* internal config (its auth
  token, session transcripts, hooks, skills) — not a secrets store. A file there never becomes a
  `process.env.*` var the app reads, and the folder is rebuilt fresh each container (not carried over
  from a prior session), so anything placed there is gone next session.
- **Assuming a previous session's `.env.local` / uploaded file persists.** Containers are ephemeral and
  cloned fresh from the repo; only committed files survive, and secrets must never be committed.
- **The ONLY mechanism that makes a secret visible to the agent in a web session** is store #1 above
  (env vars/secrets in the web environment's configuration), injected into the container as real env
  vars. This is a platform UI action the operator must do — the agent cannot place or read it for them.

## Loose ends / reminders
- **Bring `.env.local`** — the only thing not in the repo (DB password + all keys).
- **Supabase free-tier pauses after inactivity.** If scripts/app error with `FATAL (ENOTFOUND) tenant/user … not found`, the project is asleep — open the Supabase dashboard (project ref `rweclputxgwutykinlbr`) and **Restore/Resume** it.
- **Rotate secrets before production** — keys passed through chat during setup.
- **Duplicate restaurant**: empty twin "Stone Grille and Taphouse" (`cmpvtq12q000i…`) from onboarding twice — delete with `npx dotenv -e .env.local -- tsx scripts/cleanup-restaurants.ts` (lists all; add `--delete <id> --commit` to remove the empty one — refuses non-empty without `--force`).
- **Before deploy**: apply the pending migration (above); `/api/dev/*` routes are already hardened (middleware 404s them in prod **and** each handler self-guards on `NODE_ENV`, so they can stay); run `next build` with real env present; set Vercel env WITHOUT `INNGEST_DEV`. **Rotate any secrets** shared via chat during setup. Note: `middleware.ts` is correct for the pinned Next 14 — the `proxy` rename only applies if you upgrade to Next 16.
- **Gotchas** (Windows): Node may be off-PATH; run Prisma via `npx dotenv -e .env.local -- prisma ...`; use batched `$transaction([...])` over the Supabase pooler (not interactive); Clerk test emails use code `424242`; new route segments need a dev-server restart to register.
- **PowerShell execution policy** (Windows): `npx`/`npm`/`prisma` resolve to `.ps1` shims that fail with `running scripts is disabled on this system` under the default Restricted/RemoteSigned-machine policy. Two fixes: one-off, call the `.cmd` shim (`npx.cmd dotenv …`); durable, run once `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` (done on Customer-Zero machine 2026-06-13). NOTE: the Claude Code **Bash tool** runs `npx` fine (Git-Bash, no `.ps1` shim) even when the operator's PowerShell can't.
- **Prod-DB script writes must be operator-run** (2026-06-13): `tsx scripts/*.ts --commit` against shared Supabase is HARD-blocked from inside Claude Code's auto-mode, and a broad `Bash(npx dotenv:*)` allow rule is rejected too (it'd authorize arbitrary `--` passthrough). Have the **operator run the script in their own terminal**. `prisma migrate deploy` and merges-to-`main` DO proceed after an explicit in-chat "go".

## Recent commits / PRs
Earliest: init → README → categorization Phase 1/3 → Cash Flow / Vendor Spend / Spending by Category tiles
→ Labor Hours spec (`279f0a5`).
**Toast wave (2026-06-12, merged):** #3 connector + `era` analytics client → #4 allocation-spec reconcile →
#6 Covers Flow → #7 daily Inngest sync → #8 Labor Hours → #9 Sales Mix → #10 Menu Engineering.
**Bank-data wave (2026-06-12, merged):** #12 Recurring & Subscriptions → #13 Cash Runway → #14/#15 Payment
Watch (+ both-reference fix).
**Allocation + deploy wave (2026-06-13, merged — other session):** #16 allocation settings + 3-way COGS →
#17 Allocation & Variance engine core + view → `DEPLOY.md` → software-vendors→Technology fix (`c664d5a`) →
live-on-Vercel resume block (`6fb573b`).
**Debt-service + cleanup (2026-06-13, merged):** #18 Debt Service → Profit bucket (`8212ce3`, migration
applied) → `fix-debt-service-bucket.ts` data-update script (`8f591a0`) → tech-categorization fix run
(operator-run, 4 Stone Grille txns + Sandbox/Demo rules → Technology).
**CLOSED 2026-06-13:** #1 old rule-suggestions PR — superseded by the Phase-3 `RuleSuggestions.tsx` +
`suggestions.ts` already on `main` (`4af86f3`). No open PRs remain.

Toast/era scripts in `scripts/`: `test-toast-auth.ts`, `toast-list-restaurants.ts`, `toast-scope-probe.ts`,
`toast-analytics-probe.ts`, `sync-toast-metrics.ts`, `sync-toast-sales-mix.ts`, `sync-toast-menu-items.ts`,
`fix-tech-categorization.ts`, `fix-debt-service-bucket.ts`. Plus earlier: `backfill-categories.ts`,
`verify-rollup.ts`, `inspect-txns.ts`, `seed-sales.ts`, `recategorize-checks.ts`, `cleanup-restaurants.ts`,
`test-llm-extract.ts`.
