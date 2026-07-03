# Fable 5 — planning batch (2026-07-03)

Handoff + specs from the Fable 5 stress-test sessions, preserved here so they're reachable
remotely (Claude Code web / phone). Content only — no secrets. Nothing here is executed yet.

**Start with [SESSION-HANDOFF-2026-07-03-chunk5.md](SESSION-HANDOFF-2026-07-03-chunk5.md)** — it is
authoritative over every prior RESUME block and carries the ranked backlog, cut/bury list, and
investor-demo angle.

## What's here

| File | What it is |
|------|-----------|
| [SESSION-HANDOFF-2026-07-03-chunk5.md](SESSION-HANDOFF-2026-07-03-chunk5.md) | **Authoritative resume block.** Ranked enrichment backlog (code-verified vs `main`), cut/bury list, execution order, resume prompt. |
| [investor-demo-script.md](investor-demo-script.md) | 7-beat brokerage/rental demo for the first investor + T-minus checklist + objection handling. |
| [PR-rule-guardrails-and-triage.md](PR-rule-guardrails-and-triage.md) | PR write-up for `claude/rule-guardrails-and-triage` (commit `6923f48`) — **merge this first**, it strands CLAUDE.md + PRODUCT-MAP.md. |
| [RUNBOOK-stone-triage.md](RUNBOOK-stone-triage.md) | Production runbook to clear Stone's 373 sync exceptions (dry-run → live → invariants). |
| [spec-c-review-upgrades.md](spec-c-review-upgrades.md) | Review-flow upgrades (approve-as-category, rule-save, bulk-apply). Unblocks Spec A.1. |
| [spec-a1-tax-vault.md](spec-a1-tax-vault.md) | Spec A.1 — Tax Vault ledger convergence (first ledger-first module). |
| [spec-a2-cashflow-spending.md](spec-a2-cashflow-spending.md) | Spec A.2 — Cash Flow / Spending convergence + `compare-spines.ts` parity tool. |
| [SPEC-C-industry-manifest.md](SPEC-C-industry-manifest.md) | Industry Manifest system — one engine, many views. Add a vertical = one manifest + one seed pack. |
| [SPEC-C2-connector-security.md](SPEC-C2-connector-security.md) | Connector security + zero-key connect flows (crypto module, per-tenant creds, Plaid/Toast/CSV/PDF/GBP). |
| [SPEC-D-concierge-csv-spine.md](SPEC-D-concierge-csv-spine.md) | Concierge onboarding + universal CSV spine (one canonical row, dedupe rules). |
| [spec-e-billing.md](spec-e-billing.md) | Billing/packaging + founder pricing on Clerk Billing; `TenantPlan` source of truth. |
| [seed-packs-brokerage-rental.md](seed-packs-brokerage-rental.md) | Brokerage + rental rule seed packs. |
| [CLAUDE-CODE-KICKOFF-spec-c.md](CLAUDE-CODE-KICKOFF-spec-c.md) | Ready-to-paste Claude Code kickoff prompt for Spec C + C2. |

## Do-first (from Chunk 5, before anything else)

1. Merge PR `claude/rule-guardrails-and-triage` (`6923f48`) → lands CLAUDE.md + PRODUCT-MAP.md on `main`.
2. Run the triage runbook on Stone → clear the 373 open exceptions.
3. Fix or hide Sandbox Diner (48 exceptions / 0 ledger entries) before the investor meeting.
4. Revoke the GitHub PATs pasted in chat.

## Spec dependency order

```
rule-guardrails (merge)  ──►  spec-c-review-upgrades  ──►  Spec A.1 (tax vault)  ──►  Spec A.2 (cashflow/spending)
                                                                                        (Spec A = ledger convergence)
Spec C (manifest) ──► Spec C2 (connector security) ──► Spec D (concierge + CSV spine)
Spec E (billing) — independent, sequence after Spec C

For the investor meeting, Spec C Steps 3+7 (brokerage/rental manifests + earmarked rendering)
pull forward — they're label-layer only.
```

> Anti-bloat is law: lean core, optional modules, signals cap at Top 3, every number shows its math,
> never overclaim. See the handoff for the full rationale.
