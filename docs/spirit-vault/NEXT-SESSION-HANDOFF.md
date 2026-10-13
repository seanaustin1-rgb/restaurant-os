# Spirit Vault — Next-Session Handoff (Claude owns the whole build)

Last updated: 2026-08-19

**You (Claude) are now building the ENTIRE Spirit Vault — both lanes.** Codex is
unavailable, so the "Codex-owned" engine/resolver/actions/tests work is yours too, in
addition to the Claude UI/content work. There is no parallel agent to coordinate with
right now, so the shared-checkout hazards are lower — but still re-check
`git branch --show-current` before commits.

Work in the worktree: `C:\Users\Default_50\restaurant-os-spirit-migration`.

---

## 1. What is LIVE in production (outfrontdata.com)

The Spirit Vault guest + membership layer is fully live and verified in prod:

- **Daily physical-presence gate** — `/vault` is gated by a deterministic daily code
  (`day-code.ts`, HMAC of `SPIRIT_VAULT_DAY_SECRET` + venue-local date). `/v/[code]`
  unlocks for the day. Printable **code card** at `/admin/spirit-vault/today` (table
  tent) and the code appears on the placemat.
- **Account-based membership** — a member redeems a code once → their Clerk account
  carries a year of full vault access (on/off premise), bypassing the daily code.
  Codes are **HMAC-hashed** with a REQUIRED pepper (`SPIRIT_VAULT_MEMBERSHIP_PEPPER`),
  12 chars, shown once. Redemption is transactional with an atomic count guard and a
  composite tenant FK. Operator console at `/admin/spirit-vault/membership` (generate/
  revoke/list + member CSV export). Guest redeem at `/vault/join` (Clerk email
  magic-link → redeem). Gate resolver: `resolveVaultAccess` (async, tenant-aware) =
  open | day-code | active-membership | denied.
- **Member marketing** — opt-in checkbox at redemption; `GuestProfile.marketingOptIn`;
  CSV export (`/admin/spirit-vault/membership/export?opted=1`) for Mailchimp/Toast.
- **Vault opens on the browse landing** (not the first bottle).
- **Flight builder (manual)** — create/edit/reorder/publish/delete flights, per-pour
  bites (internal prep sheet), guest placemat (Legal print) + prep sheet + digital
  guest flight page. Pricing `component_1oz_sum_v1`. **Flights capped at 4 pours.**
- **Flight template picker** (`/admin/spirit-vault/flights/new`) — pick a template →
  through-line preloads + slot guidance shows → select up to 4 → save DRAFT.

## 2. The ACTIVE task: finish the ASAP Flight Builder

Full plan: `docs/spirit-vault/FLIGHT-BUILDER-ASAP-BUILD-PLAN.md`. Target: a workable
staff builder by Fri 2026-08-21. The template PICKER (Claude Phase 2) is merged
(#160). Remaining, now all yours:

1. **Candidate resolver (was Codex Phase 1) — build `src/lib/spirit-vault/flight-template-candidates.ts`.**
   Given a `FlightTemplate` (from `src/lib/spirit-vault/flight-templates.ts` — the
   CONTRACT, already built) return eligible pours per slot. Enforce, scoped to the
   staff `restaurantId`:
   - `VenueSpirit.recordStatus = PUBLISHED` AND `publicationStatus = PUBLISHED`
   - a priced, sized `SpiritPour` (`priceUsd`/`pourSizeOz` not null; prefer `isPrimary`)
   - rank Toast-backed pours first when `toastItemGuid` is present; do NOT hide
     manually-confirmed pours if Toast coverage is incomplete
   - apply each slot's `FlightTemplateRules` (proofMin/Max via `SpiritDefinition.proofN`;
     categories; searchTerms against name/style/production text; requiresBottledInBond;
     requiresVenueVoice via whyWeCarry/seanShort/notes)
   - `autoOrder`: slot-order | proof-asc | proof-desc
   - **Tests**: tenant scoping, guest-visibility, priced-pour requirement, each rule.
   NOTE: confirm which fields actually exist on `SpiritPour` (`availability`,
   `commerceSource`, `toastItemGuid`) before filtering on them — hedge with "when present."
2. **Wire the resolver into the picker (Claude Phase 2 follow-up).** In
   `TemplatedFlightBuilder.tsx` / the new-flight page: filter/group candidates by slot,
   and map a chosen pour to its slot's `itemNote`. Today the picker only applies the
   through-line + guidance + the 4-cap; selection is from the full eligible pool.
3. **Save-validation hardening (was Codex Phase 3) — `flights/actions.ts` + `.test.ts`.**
   Selected pour must belong to the selected `VenueSpirit`; count 2–4; DRAFT default;
   reprice via `component_1oz_sum_v1`; tests for cross-tenant + stale/ineligible pour
   rejection.
4. **Placemat copy review (Claude Phase 4).** Through-line + per-pour "what to notice"
   render cleanly; print layout still fits real data; no guest-facing template jargon.

## 3. Backlog after the Flight Builder (agreed order)

1. **Tasting journal / Passport / Curator-vs-you** (needs new `GuestTasting` /
   `GuestFavorite` tables — designed but not built; see PHASE2-GUEST-LAYER-SPEC.md).
2. What-to-try-next recommendations (needs Passport data first).
3. Monthly owner reports (flight usage + Passport).
4. Pay-to-join automation via Clerk Billing (today it's code-redemption only).
5. Per-member bulk single-use codes.
6. Stone site → hosted vault entry block / QR.
7. Distillery verified content layer.
8. **⏸ White-label / multi-tenant** — PARKED until the above are built. Guest vault on a
   **venue-branded subdomain (`vault.mysite.com`)**, NOT outfrontdata.com ("outfrontdata"
   reads as data-mining to guests). Needs URL-based tenant routing (replace the single
   `SPIRIT_VAULT_RESTAURANT_ID` env), an embed, and per-venue branding. Data layer is
   already tenant-scoped by `restaurantId`.

## 4. Non-negotiable spine (Sean)

1. Hosted `restaurant-os` Vault is the secure membership/access layer; the Stone
   website is only a link/QR entry point.
2. Everything tenant-scoped by `restaurantId`; NO Stone/Echo-only hardcoding in shared
   models/routes/templates.
3. Access/membership codes: server-verified, **hashed at rest**, expirable, revocable,
   auditable — never in static HTML/JSON.
4. Guest UX simple; admin UX operator-friendly.
5. Flights reference spirits/pours, never copy dossier content; 1 oz basis; pricing is a
   suggestion (`component_1oz_sum_v1`).

## 5. Environment / tooling gotchas (so you don't relearn)

- **Prisma:** pin `npx --yes prisma@5.22.0` (plain `npx prisma` pulls v7 which rejects
  `url`/`directUrl`). After a schema change run `prisma generate` (shared
  `node_modules` — regen for the branch you're typechecking; a stale client throws
  phantom TS errors on new fields — the fix is regenerate, not code changes).
- **Migrations:** generate OFFLINE (no DB needed):
  `git show HEAD:prisma/schema.prisma > /tmp/old.prisma` then
  `npx --yes prisma@5.22.0 migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script`
  → save under `prisma/migrations/<UTCstamp>_name/migration.sql`; hand-add CHECK
  constraints Prisma's DSL can't express. Verify by applying to the **demo** DB only:
  `DATABASE_URL=$DEMO DIRECT_URL=$DEMO npx --yes prisma@5.22.0 migrate deploy`
  where `$DEMO` = `DEMO_DIRECT_URL` from `C:\Users\Default_50\restaurant-os\.env.local`
  (direct host `db.jzjscsoasfjsxekyfrgi.supabase.co:5432`). **NEVER apply to prod** —
  that's Sean's gated deploy step; hand him `prisma migrate deploy` when ready.
- **DB IDs:** demo/prod vault tenant = **Demo Bistro**, restaurant id
  `cmqnyvbab0000osvwrxhaovxo`, set via `SPIRIT_VAULT_RESTAURANT_ID`. Admin console
  scopes codes to the STAFF's own restaurantId — it must equal the vault tenant for the
  loop to work (it does for Demo Bistro).
- **Verify DB logic with a throwaway smoke script** against demo (generate → redeem →
  assert → clean up), like `scripts/_tmp_*.ts` run with `npx tsx`. Authed pages can't
  be visually verified locally (no Clerk/DB session) — `next build` validates render.
- **Env vars in prod (Sean's):** `SPIRIT_VAULT_DAY_SECRET`, `SPIRIT_VAULT_MEMBERSHIP_PEPPER`,
  `NEXT_PUBLIC_APP_URL=https://www.outfrontdata.com`, `SPIRIT_VAULT_RESTAURANT_ID`.

## 6. Git / CI discipline

- main = prod. Branch protection: PR + **Typecheck/Test/Build/Codex-Review** green +
  up-to-date required. **All merges are Sean-gated** — build, get green, present, let
  Sean say merge. When a PR goes BEHIND, `gh pr update-branch <n>`, wait for CI, merge.
- Gates before every push: `npx tsc --noEmit` = 0, `npx vitest run` green,
  `npm.cmd run build` succeeds.
- PowerShell has no `&&`; use the Bash tool for POSIX. Heredoc bodies with apostrophes
  break — write PR bodies to a file and use `gh pr create --body-file`.

## 7. First move for the next session

Confirm with Sean, then build **§2.1 (the candidate resolver)** on a fresh branch off
main — it's the keystone that unblocks the rest of the Flight Builder. Then §2.2 wiring,
§2.3 hardening, §2.4 placemat review. Ship each as its own green, Sean-gated PR.
