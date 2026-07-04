# OUTFRONT DATA — MASTER ROADMAP (2026-07-03)
Investor meeting: ~1 week | Launch: ~1 month

## BUCKET A — THIS WEEK (before investor meeting)

- [ ] A1. Revoke ALL exposed GitHub PATs (5+ across chunks) — security-critical, 10 min.
      New rule: fine-grained, single-repo, Contents:Read-only, 7-day expiry. [S]
- [ ] A2. Open + merge PR main...claude/rule-guardrails-and-triage (commit 6923f48) —
      CLAUDE.md + PRODUCT-MAP.md are stranded on it; Claude Code auto-load is broken
      until this merges. Blocks every session below. [S]
- [ ] A3. Commit all drafted specs to docs/specs/ + pointer lines in PRODUCT-MAP.md:
      spec-c-review-upgrades, spec-a1-tax-vault, spec-a2-cashflow-spending,
      SPEC-C2-connector-security, SPEC-D-concierge-csv-spine, spec-e-billing,
      SPEC-C-industry-manifest, seed-packs, investor-demo-script. [S]
- [ ] A4. Submit Toast Partner Connect application — external SLA, longest lead time
      in the whole plan; gates Spec B. Submit now, build later. [S]
- [ ] A5. Execute Spec C (review upgrades: approve-as-category, rule-save w/ guardrail,
      bulk-apply by vendor signature). One branch, Codex /review. DoD: 373 clearable
      <10 min. [M]
- [ ] A6. Clear Stone's 373 sync exceptions via new bulk tools; run
      summarize-sync-exceptions.ts before/after (that diff is a demo asset). [S]
- [ ] A7. Fix or pull Sandbox Diner (48 exceptions / 0 ledger) — can't be on screen. [S]
- [x] A8. Build 30-day forward cash (backlog #2) — assembly not build: Recurring module
      + payroll cadence inference + sweep dates. Demo Beat 2 depends on it; investor #1
      is vacation-property — forward obligations is his game. [M]
      DONE 2026-07-04 — merged (Forward Cash module, live tile, 9 pure-fn tests).
- [x] A9. Build daily digest (backlog #1) — clone dailyPlaidSyncScheduler fan-out,
      cron ~7:45 ET, content already in signals.ts. Demo Beat 1 (6am digest on phone)
      and the retention mechanism. [M]
      DONE 2026-07-04 — merged (PR #95). Deterministic content from signals.ts +
      Forward Cash low-point; Inngest scheduler + Resend worker; external send hard-gated
      behind DAILY_DIGEST_ENABLED=true + RESEND_API_KEY (off until the operator opts in).
- [ ] A10. Verify brokerage demo tenant reseed; seed with brokerage RuleSeeds pack. [S]
- [ ] A11. Rehearse investor-demo-script twice; record screen-capture fallback. [S]

## BUCKET B — BEFORE LAUNCH (~1 month)

- [ ] B1. Spec A.1 Tax Vault — ledger-first w/ fallback, accrued vs cleared, PA config,
      drift signal. Hard gate: A6 done. Sandbox = fallback canary. [M]
- [ ] B2. Spec A.2 Cash Flow/Spending — shared fallback fn, ledger↔TapBucket mapping
      table, compare-spines.ts. DoD: Stone deltas <1% trailing 30d. [M]
- [ ] B3. Spec A.3 Break-even/Prime Cost/Allocation — GATED on compare-spines output;
      highest-stakes read-path (allocation math). [L]
- [ ] B4. Data-health score gating confidence language (backlog #4) — makes the 95%
      claim mechanically honest. [S]
- [ ] B5. Allocation residual rendering (backlog #6) — "Named $X of $Y — $Z unnamed,"
      click-through to review; residual IS the leak detector. [M]
- [ ] B6. Cash floor + sweep safety (backlog #5) — one setting, breach alert, pre-sweep
      warn. Cheap after A8. [S]
- [ ] B7. Payroll forward accrual, inferred (backlog #3) — cadence + avg last 4 pulls;
      feeds A8, retires cleared-pulls-only debt. [S/M]
- [ ] B8. Spec E billing — TenantPlan mirror + Clerk webhook → gate Inngest fan-outs →
      /pricing PricingTable → module route walls. Independent of A/B/D. [M]
- [ ] B9. Spec C2 onboarding wizard — "≈5 min. No API keys — ever." Anchor → Plaid/PDF →
      vertical spine → optional sharpen. Attacks the #1 adoption risk directly. [M]
- [ ] B10. Spec D concierge + CSV spine — CanonicalRow, ImportBatch/ImportMapping,
      dedupe w/ trust order, /admin/provisioning act-on-behalf. After Spec C. [L]
- [ ] B11. Spec C industry manifest — Step 2 (restaurant extraction, own PR) then 3–8;
      export Stone rules as restaurant seed pack; brokerage/rental manifests. [M]
- [ ] B12. Anti-bloat cuts: Aura/GBP out of onboarding, "soon" tiles → Roadmap page,
      show restaurant + brokerage verticals only. [S]
- [ ] B13. Virtual Pilot flow — 90-day CSV backdated run + 14 days live digests;
      conversion pitch = the dollar residual. (Mostly falls out of B10 + A9.) [M]

## BUCKET C — POST-LAUNCH / MODULES

- [ ] C1. Spec B Toast multi-tenancy — REQUIRED before restaurant customer #2;
      white-glove (C2 Template A) is the bridge until Partner Connect approves. [M]
- [ ] C2. Spec A.4 investor matrix. [M]
- [ ] C3. Month-end pace projection (#7) + missed-deposit alert (#8, extend Payment
      Watch). [S each]
- [ ] C4. Vendor intel module (#9): new-vendor >$500, spend creep >20% & >$500. [S]
- [ ] C5. Recategorize retro-move UX (recategorize-transactions.ts --commit surfaced). [S]
- [ ] C6. Branch hygiene: triage/kill ~19 unmerged branches. [S]
- [ ] C7. Payroll API connectors, QBO OAuth (reuse GBP handler), MLS — Rung 3. [L]

## DEPENDENCIES
- A2 blocks ALL Claude Code sessions (auto-load broken).
- A5 → A6 → B1 → B2 → B3 (human checkpoint at A6 gate — don't let a session run through it).
- A8 feeds A9 content, B6, B7, C3.
- A4 (Partner Connect) gates C1 — external timeline, submit immediately.
- B8 TenantPlan must exist before any route walls or pricing page.
- B10 depends on A5 merged.

## TOP 3 RISKS
1. Demo scope collision: Spec C + digest + forward-cash all in one week.
   → Mitigate: A8/A9 are assembly of live pieces, not new builds; screen-recording
   fallback recorded at A11; contingency pivot = "373 exceptions cleared in 10 min"
   is itself a demo beat.
2. Spine disagreement surfaces in front of a customer (Spec A unexecuted).
   → Mitigate: no UI surface renders both spines pre-A (already policy); Cash Oxygen
   pattern only; compare-spines.ts is the acceptance gate before A3 touches allocation.
3. Onboarding friction kills customer #2+ (Toast single-tenancy, key-gathering).
   → Mitigate: white-glove concierge (staff provisions, client never touches keys),
   Partner Connect submitted week 1, Virtual Pilot requires zero credentials.

## SINGLE HIGHEST-LEVERAGE NEXT ACTION
Revoke the PATs (10 min), then immediately merge the stranded guardrails PR.
Every Claude Code session until that merge runs without CLAUDE.md/PRODUCT-MAP.md
auto-loading — you're paying an orientation tax on every task in this list.
Merge it today, then kick off the Spec C session tonight.

---

## Reviewer's honest flag (captured 2026-07-03)

- **Bucket A is aggressive** — six ship items plus a demo rehearsal in a week. If something
  has to drop, **drop A9 (digest) before A8 (forward cash)**. The forward-cash low-point
  sentence is the beat that lands with a vacation-property investor; the digest can be shown
  as a mock in the deck and shipped for launch.
- **Chunk 6 deliverable was never produced** — Chunk 7 flagged that the one-engine/many-views
  + brokerage day-1 view was not delivered. Nothing in this roadmap depends on it, but it can
  be built before the meeting if wanted (decision pending).
