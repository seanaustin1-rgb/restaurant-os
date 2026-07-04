# Claude Code kickoff — Spec C (+ C2) execution

Paste this as the opening prompt in Claude Code, from repo root, after dropping `SPEC-C-zero-key-onboarding.md` and `SPEC-C2-connector-security.md` into `docs/`.

---

Read, in order: `CLAUDE.md`, `docs/PRODUCT-MAP.md`, `docs/SPEC-C-zero-key-onboarding.md`, `docs/SPEC-C2-connector-security.md`.

Create branch `claude/spec-c-onboarding-ladder` off latest `main`. Implement SPEC-C fully, and from SPEC-C2 implement §1 (crypto module), §2 (schema), §3 (server-side exchange rules), and the Vitest cases in §7. SPEC-C2 §4 flows: implement Plaid Link (4.1), uploads (4.3/4.4), and the Toast white-glove handler (4.2 white-glove mode only); the GBP generic OAuth handler (4.6) only if the existing GBP connection can be migrated onto it without touching its daily snapshot job — otherwise leave GBP as-is and note it.

Hard constraints (also in CLAUDE.md, restated because they gate acceptance):

1. **Additive migrations only.** No column drops, no renames, no data migrations on existing tenants. Stone's Toast stays on global env creds — do not touch that path.
2. **196 existing Vitest green** plus the new coverage from SPEC-C2 §7 and SPEC-C's registry/gate/transition tests. Run the full suite before every commit.
3. **No secret in client code, logs, or URLs.** Add the grep-based CI check from SPEC-C2 acceptance criteria.
4. **Single registry.** `src/lib/onboarding/sourceLadder.ts` is the only source of truth for wizard steps, `/settings/sources` grouping, locked tiles, and unlocks. If you find yourself hardcoding a source anywhere else, stop and route it through the registry.
5. **Out of scope — do not touch:** the two financial spines, `categorize()` / rules, bucket sweeps, Spec B OAuth, Rung-3 connectors (marginedge/qbo/payroll/fub get registry entries + locked tiles only, no implementation).

Working style: commit in reviewable slices (schema → crypto → registry → wizard → sources hub → admin queue → emails → tests), one concern per commit, conventional messages. When SPEC-C and SPEC-C2 conflict on a detail, SPEC-C2 wins on security, SPEC-C wins on UX/copy. If something is genuinely ambiguous, make the boring choice, note it in the PR description, keep moving.

When done: push branch, write the PR description (what/why/testing/out-of-scope, same shape as the repo's prior PRs), do not merge. List anything you deferred and why.

---

## Post-run review checklist (Sean, ~10 min before opening the PR)

- [ ] `npx vitest run` locally — full green, count ≥ 196 + new
- [ ] `npx prisma migrate diff` shows additive only
- [ ] Grep client dirs for `access_token`, `credentialsEnc`, `ENCRYPTION_KEY` — zero hits
- [ ] Walk the wizard as a fresh restaurant tenant in dev: anchor → Plaid sandbox → Toast request → skip sharpen → dashboard renders with locked tiles naming unlocks
- [ ] Walk it as brokerage type: no Toast tile anywhere, CSV spine step present
- [ ] Toast tile click → row in `/admin/provisioning`, Resend fires (check dev mode/log)
- [ ] `/settings/sources` shows Core/Sharpen/Depth with correct status badges
