# Directive for Codex — Spirit Vault, 2026-09-04

Supersedes the "Directives from Sean" block produced by Gemini earlier today.
Gemini has **no repo access**; two of its three directives were adjusted after
checking them against the actual code. Where this document and that block differ,
**this one wins**. Differences are marked ⚠ and explained, so nothing is silently
dropped.

Full context: `docs/spirit-vault/CODEX-RESTART-HANDOFF.md`.
Spec of record: `docs/spirit-vault/PHASE2-GUEST-LAYER-SPEC.md` §6 (read §6.5 first
— it supersedes §6.1).

---

## 1. Branch cleanup — do this before anything else

**Adopted from Gemini unchanged.** This is the bottleneck.

- Stop adding features to the stacked PRs.
- `main` has not moved since 2026-08-19; ~17 PRs are queued behind it.
- **Blocked on Sean:** PRs #162 (Claude) and #163 (Codex) are competing
  implementations of the same flight-builder work, touching **all 12 of the same
  files**. Each merges cleanly into `main` alone; they will not merge into each
  other. Sean picks the base — do not merge both, and do not start a third.
- Once he picks: cherry-pick the loser's unique work into the winner, close the
  loser, land it.
- **Rescue #145.** It is 13 commits behind `main` and conflicts on 3 files, largely
  because `11a0b7b "Open Spirit Vault to browse view"` re-implements `09b6f7f`
  (#156), already merged. Update from `main`, resolve the browse-landing conflict
  **in favor of `main`**, re-run the green gate, merge.

---

## 2. The coin is a membership, not a consumption reward

**Adopted from Gemini unchanged — this is the strongest item in that block.**

The challenge coin represents an **Echo's Reserve Annual Membership**. It is not
an open consumption contest. Entitlements: member-tier pours, first access to
release tastings, invitation to the bi-annual member holiday party.

**This shrinks the build.** No milestone→coin fulfillment pipeline is needed. The
membership spine already ships and is verified in production: `GuestMembership`,
`MembershipCode` (HMAC-hashed, plaintext shown once, revocable),
`MembershipRedemption` (append-only), one-year entitlement.

Worth proposing to Sean, not to build unasked: **put the membership code on the
coin.** The coin becomes the credential. Codes already bind to the first account
that redeems, so a photographed coin is useless once claimed — no new mechanic.

---

## 3. ⚠ The passport is ATTENDANCE — replaces Gemini's directive 1

> Sean, 2026-09-04: "The passport is only that they attended that day."

**Gemini's "exactly 1 check-in per guest per calendar day" was the right rule
attached to the wrong entity.** It proposed capping *tasting* records at 1/day,
which would have broken flights (up to 4 pours), "curator vs. you", and
"what-to-try-next". Sean then clarified the passport is a **visit record**, not a
tasting log — so the 1/day rule is correct, applied to the **stamp**.

### 3.1 Scope cut

| | v1 | Later |
|---|---|---|
| Passport entry | attendance for a day | unchanged |
| Tasting notes / ratings | **cut** | returns as the contribution layer |
| Milestones / badges | **cut** | revisit after the above |
| Earned status | none | contributor reputation, "local guide" model |

Future status is earned by **contributing** — writing useful notes, recommending
to other guests — **not by consuming**. Materially safer than a consumption
milestone, and a better motive for writing notes at all.

### 3.2 Schema — one table, no catalog binding

**⚠ `GuestTasting` is DEFERRED. Do not build it. v1 has no `venueSpiritId`.**

Key on `(guestId, restaurantId, stampedDayKey, kind)`:

- `stampedDayKey` — venue-local `YYYY-MM-DD` of the code that stamped it.
  Non-null by construction.
- `kind` — which code was scanned (see 3.3).
- `@@unique([guestId, stampedDayKey, kind])` — one stamp per guest per day per kind.
- Tenant-scoped by `restaurantId`, following the existing composite
  tenant-agreement FK pattern.

The `@@unique([guestId, venueSpiritId])` rule in spec §4 belongs to the deferred
tasting layer. It is **not** the passport rule.

### 3.3 Special events — a second code, not a special case

Sean wants a double check-in on event nights. **Do not add a weight/multiplier
column or an exception branch.** Give the event its own printed card, derived from
the same primitive with a different input:

```
daily code = HMAC(secret, `${tenant}:${dateKey}`)             // existing table tent
event code = HMAC(secret, `${tenant}:${dateKey}:${eventId}`)  // event card
```

Same properties as the day code: deterministic, reprintable, unforgeable, no DB,
no cron. A guest at an event scans both and gets two stamps naturally, because
they are different `kind` values on the same day. The rule stays "one per guest
per day per kind," with nothing to special-case.

### 3.4 Write rule — non-negotiable

- Gate stamp writes on `resolveVaultAccess().via === "day-code"`, **not** on
  `allowed`. Reading may go off-premise on the future paid tier; **writing a stamp
  never may.** The stamp is the proof of presence — that is the entire product.
- **Stamps must be Server Actions under `/vault/*`.** `/v/[code]/route.ts` sets the
  `sv_day` cookie with `path: "/vault"`. An API route at `/api/passport/**`
  receives nothing and every stamp fails silently. Colocate with
  `src/app/vault/actions.ts`.
- With `SPIRIT_VAULT_DAY_SECRET` unset the gate resolves `via: "open"` and no stamp
  can ever be written. Correct behavior — but it means the secret is a hard
  prerequisite, and `.env.local` has none. Prod status is **unverified**
  (`vercel whoami` → logged out).

### 3.5 Making it worth opening

A pure attendance passport is thin, and the guest supplies nothing. Render each
attended date with what was actually poured that day, derived from **existing
flight records** — "Aug 12 · the night we poured the Sagamore flight." No guest
input, no new data, and it stays a record of being there.

---

## 4. ⚠ Catalog — "all 200 active" is not achievable

**Gemini's directive 3 said the catalog requires all 200 records active. It does
not, and pursuing it would force fabrication.**

The publish validator requires, per record, **exactly 3 non-empty `topNotes` and
all 7 flavor axes as integers 0–10**. Of the 91 drafts:

| Tier | Count | Status |
|---|---|---|
| **A — source-ready** | 57 | Facts cited. Flavor radar is a deliberate unsourced placeholder; several have only 1–2 genuinely sourced notes. |
| **B — identity unconfirmed** | 25 | Cannot be written. Jose Cuervo SKU unknown; Apostoles Rosa unidentified; Moko Dark producer disputed between Toast and shelf labels. |
| **C — house / generic flavored** | 8 | Sean has not decided whether they get dossiers at all. |

Making all 200 pass the gate means **inventing tasting notes and flavor scores for
~91 bottles** — a direct violation of the standing guardrail against fabricating
facts or tasting judgments.

**Correct target: 109 → ~166** (109 published + the 57 Tier A), and even that
requires Sean's tasting pass to set the radar. The remaining 33 are blocked on
**his answers**, not on engineering effort. Full breakdown:
`docs/spirit-vault/DRAFT-CONTENT-AUDIT.md`.

**Do not publish any draft record without Sean's explicit per-record approval.**

---

## 5. Standing guardrails

1. Never publish a draft spirit without Sean's approval. `verificationStatus:
   source-reviewed` describes the **facts**, not permission.
2. Never run the importer with `--apply`; never migrate prod. Demo DB
   (`jzjscsoasfjsxekyfrgi`) only, direct host, WARP on. Dry runs are read-only.
3. Never create a second spirit catalog. `SpiritDefinition` / `VenueSpirit` /
   `SpiritPour` / `SpiritPriceObservation` is canonical.
4. Never re-enable the Supabase Data API. RLS is off on all 47 public tables.
5. Venue voice is Sean's — `whyWeCarry`, `seanShort`, `notes` stay pending.
6. Never invent a fact or a tasting note. Cite or mark pending.
7. Tenant-scope everything by `restaurantId`.
8. Membership codes stay hashed at rest; plaintext shown once.
9. **The scan code is not on the flight placemat** — it is its own table tent,
   because not every guest orders a flight. `main` still renders it on the
   placemat; #163 stopped rendering it but left `qrSvg()`/`todayCode()` computed
   and passed as an unused param. Finish that cleanup on the winning branch.
10. Shared working tree with Claude: run `git branch --show-current` before every
    commit, stage explicit paths, never `git add -A`.

---

## 6. Order of work

1. Get Sean's answer on **#162 vs #163**. Nothing in that lane moves until then.
2. Land the flight builder; finish the placemat cleanup (§5.9).
3. Rescue and merge #145.
4. Get `main` current.
5. **Then** build the passport: one stamp table (§3.2), event code (§3.3), stamp
   Server Action, passport view. Migration on **demo only**.

Green gate before every push: `npm.cmd test -- --run src/lib/spirit-vault`,
`npm.cmd test`, `npx tsc --noEmit`, `npm.cmd run build`.

---

## 7. Open, needs Sean — do not guess

1. **#162 or #163** as the flight-builder base.
2. Tier C house/flavored vodkas — dossiers or shelf-only? Blocks 8 records.
3. Jose Cuervo — which SKU?
4. Apostoles Rosa — which product, and is it agave at all?
5. Moko Dark — Toast says `Maison Peryat`, shelf says `Maison Ferrand Plantation`.
6. Herradura Ultra — if it is the Ultra Añejo Cristalino it is misfiled under
   `blanco-silver`.
7. Ketle Vodka — venue spelling stays, but is the bottle Ketel One?
8. Flavor radar — will Sean taste through the 57 Tier A records and set the axes?
   This gates the 109 → 166 publish.
9. If the coin is the membership, do milestones become digital-only badges later,
   or go away entirely?
