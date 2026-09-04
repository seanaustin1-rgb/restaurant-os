# Codex restart handoff — Spirit Vault

**Written by Claude, 2026-09-04.** Every claim below was verified against
`origin` on that date, not recalled. Where something is unverified it says so.

Read this top to bottom before touching a branch. The repo is in a **stacked,
partially-duplicated state** and the most expensive mistake available right now
is rebuilding something that already exists on another branch.

---

## 1. The one-paragraph situation

`main` has not moved since **2026-08-19** (`53ce1d8`, flight template picker #160).
There are **17 open PRs**. Two of them — #162 (Claude) and #163 (Codex) — are
**competing implementations of the same flight-builder work touching all 12 of the
same files**. PR #145 has good work from both agents but is now 13 commits behind
`main` and conflicts on 3 files, partly because it re-implements a fix already
merged to `main`. Nothing is broken in production; everything is stuck in review.

**The first job is not new features. It is landing what exists.**

---

## 2. Ground truth (verified 2026-09-04)

### Branch / PR state

| PR | Branch | Mergeable? | Notes |
|---|---|---|---|
| **#163** | `codex/flight-builder-availability-hardening` | **merges clean into main** | Codex's. 10 commits, last 2026-08-23. Availability hardening + candidate engine + placemat layout. Draft. |
| **#162** | `claude/spirit-vault-flight-builder-x71qai` | **merges clean into main** | Claude's. Last 2026-08-25. **Overlaps #163 on 12/12 files.** Draft. |
| **#145** | `feat/spirit-vault-draft-loader` | **CONFLICTS** | Draft content + admin routing + static export. See §4. |
| #161 | `docs/next-session-handoff` | clean | Handoff doc, non-draft, unmerged. |
| #159 | `codex/spirit-vault-flight-builder-plan` | behind | The build plan #162/#163 were both built from. |
| #151 | `docs/phase2-guest-layer-spec-v2` | behind | Guest-layer spec. |
| #146 | `claude/previous-session-continuation-ls0rka` | clean | Sean's answers to the 7 audit questions. |
| — | `feat/spirit-vault-passport-stamp` | clean | **New, 2026-09-04.** Passport stamp spec (§6 of the guest-layer spec). No PR yet. |

Plus ~9 older non-Spirit-Vault PRs (#138, #121, #120, #113, #106, #105, #103, #91, #63, #53) — out of scope here, but they are why the PR list is noisy.

### ⚠ #162 vs #163 — identical file surface

Both branches modify **exactly these 12 files**:

```
package-lock.json
src/app/admin/spirit-vault/flights/actions.test.ts
src/app/admin/spirit-vault/flights/actions.ts
src/app/admin/spirit-vault/flights/new/page.tsx
src/app/vault/flights/[id]/placemat/route.ts
src/components/spirit-vault/SpiritFlightCreateForm.tsx
src/components/spirit-vault/TemplatedFlightBuilder.tsx
src/lib/spirit-vault/flight-template-candidates.server.ts
src/lib/spirit-vault/flight-template-candidates.test.ts
src/lib/spirit-vault/flight-template-candidates.ts
src/lib/spirit-vault/flight-templates.ts
src/lib/spirit-vault/flight-view.ts
```

This is the direct result of the lane split collapsing: the plan (#159) gave Codex
the engine/resolver and Claude the picker UI, but **both agents ended up building
both halves**. Each merges cleanly into `main` *alone*; they will not merge cleanly
into each other.

**Do not "fix" this by merging both.** Sean picks one as the base. The other gets
cherry-picked into it or closed. That decision is his, not ours — see §6.

---

## 3. Two product rules Sean set on 2026-09-04

These are new since every existing doc and they change code.

### 3.1 The scan code is NOT on the flight placemat

> "the placemat does not have the scan code… the scan code is separate because
> not everyone will do the flight."

Every guest needs a way in, and not every guest orders a flight. The scan code
lives on its own printed piece — the staff table tent at
`/admin/spirit-vault/today`. The placemat is a separate artifact.

**Current state:**
- `main` — placemat **still renders the QR + code**. Wrong per this rule.
- `#163` — layout no longer renders it ✅, **but** the route still calls
  `qrSvg()` / `todayCode()` and passes an unused `qr` param. Dead code; also drop
  the now-unused `dayGateEnabled` / `qrTargetUrl` / `qrSvg` imports.

So the correct behavior exists only on #163 and is unfinished. Whoever lands the
flight-builder work owns finishing it.

### 3.2 The scan code is the passport stamp

> "The passport is driven by the scan code… the scan code is the stamp on the
> passport that they were here."

This splits the gate into read and write:

| | On-site (valid day code) | Off-premise member (future paid tier) |
|---|---|---|
| **Read** vault / passport | ✅ | ✅ — this is what the tier buys |
| **Write** a stamp | ✅ | ❌ **never** |

Full spec: **`docs/spirit-vault/PHASE2-GUEST-LAYER-SPEC.md` §6** (branch
`feat/spirit-vault-passport-stamp`). Key consequences for implementation:

- Gate writes on `resolveVaultAccess().via === "day-code"` — **not** on `allowed`.
- `GuestTasting` gains `stampedDayKey` (venue-local `YYYY-MM-DD`). Distinct keys
  per guest = visit count, with no visits table.
- **Check-ins must be Server Actions under `/vault/*`.** `/v/[code]/route.ts`
  sets the `sv_day` cookie with `path: "/vault"`, so an API route at
  `/api/passport/**` receives nothing and every stamp silently fails.
- With `SPIRIT_VAULT_DAY_SECRET` unset the gate resolves `via: "open"` and **no
  stamp can ever be written**. `.env.local` does not set one (verified) — so the
  stamp path cannot be exercised locally until someone adds a dev secret.

  **Prod status is UNKNOWN, not "missing."** Sean's notes say he set it
  2026-08-18, but this session could not confirm it: the Vercel CLI is **logged
  out** (`vercel whoami` → "Logged out."), and the first attempt piped stderr
  through the same grep as stdout, so an auth error and a genuine "not set"
  produced identical empty output. Do not read that as evidence the secret is
  absent. To actually check:

  ```bash
  npx vercel login
  npx vercel env ls production | grep -i spirit_vault
  ```

`GuestTasting` / `GuestFavorite` **do not exist in the DB.** Spec only.

---

## 4. PR #145 — what happened and what it needs

Good news: nothing was lost. History is linear and both agents' work survives.

```
11a0b7b Open Spirit Vault to browse view          <- Codex
938be47 Document Spirit Vault website export runbook <- Codex
7bb3ea1 Add Spirit Vault static artifact export      <- Codex
99c27f0 Fix draft audit tier tallies              <- Claude
c5d7312 Source-review 26 agave/rum/vodka drafts    <- Claude
23f09d5 Fix Spirit Vault admin access typecheck    <- Codex
```

**Why it conflicts:** the branch is **13 commits behind `main`**, and
`11a0b7b "Open Spirit Vault to browse view"` re-implements
`09b6f7f "fix(spirit-vault): open the guest vault on the browse landing (#156)"`
**which is already merged to `main`.** Conflicts land in:

```
docs/spirit-vault/spirit-vault-prototype.html
src/app/vault/route.ts
src/app/vault/route.test.ts
```

**Recommended resolution:** update the branch from `main`, and resolve the browse
-landing conflict **in favor of `main`** (#156 is the shipped version) unless
`11a0b7b` demonstrably does something #156 does not. Re-run the green gate after.

**Claude's content work on this branch (c5d7312, 99c27f0) is complete and self-contained:**
26 agave/rum/vodka records source-reviewed and still DRAFT/hidden; corpus verified
unchanged at 200 records / 200 unique slugs / 109 guest-visible / 91 drafts;
importer dry run `0 inserts / 200 updates`, no validation failures. Audit at
`docs/spirit-vault/DRAFT-CONTENT-AUDIT.md`. **Do not publish any of it** — see §5.

---

## 5. Hard guardrails — do not violate without Sean saying so

1. **Never publish a draft spirit.** `recordStatus` / `publicationStatus` stay
   `draft` until Sean approves each one. `verificationStatus: source-reviewed`
   describes the *facts*, not permission.
2. **Never run the importer with `--apply`, and never migrate prod.** Demo DB
   (`jzjscsoasfjsxekyfrgi`) only, direct host, WARP on. Dry runs are read-only and
   fine.
3. **Never create a second spirit catalog.** `SpiritDefinition` / `VenueSpirit` /
   `SpiritPour` / `SpiritPriceObservation` is canonical. No `BeverageItem`, no
   `bottles` table.
4. **Never re-enable the Supabase Data API.** It was disabled 2026-08-09 on both
   projects because RLS is off on all 47 public tables with a public anon key.
   Access control is Clerk + Prisma server-side. Re-enabling re-exposes everything.
5. **Venue voice is Sean's.** `whyWeCarry`, `seanShort`, `notes` stay
   "Pending Sean review." Never write them for him.
6. **Never invent a fact or a tasting note.** Cite a source or mark it pending.
   Flavor radar / body / finish are tasting judgments and stay flagged as
   unsourced placeholders until Sean tastes them.
7. **Everything is tenant-scoped by `restaurantId`.** No Echo-only or Stone-only
   assumptions in shared models or routes.
8. **Membership codes are hashed at rest** (HMAC-SHA256 + required pepper),
   plaintext shown once. Never store or log a plaintext code.

---

## 6. Shared-checkout hazard — read this before you commit

Claude and Codex **drive the same working tree** at
`C:\Users\Default_50\restaurant-os`. During the 2026-09-04 session the branch
changed under Claude twice (a fast-forward mid-task, then a switch to
`codex/flight-builder-availability-hardening`).

**Rules:**
- `git branch --show-current` immediately before **every** commit.
- Never commit onto a branch owned by the other agent.
- Stage explicit paths. Never `git add -A` — the tree carries a lot of unrelated
  untracked files (`.codex/`, `PRODUCT.md`, `Fable 5/`, local JSON dumps).
- Prefer an isolated worktree for long tasks.

---

## 7. Suggested first actions, in order

1. **Unblock the flight builder.** Ask Sean: **#162 or #163 as the base?** Then
   cherry-pick the other's genuinely-unique work into the winner and close the
   loser. Nothing else in this lane should move until that is answered — every
   further commit widens the divergence.
2. **Finish the placemat rule (§3.1)** on the winning branch: stop rendering the
   QR/code, and delete the now-dead `qrSvg` / `todayCode` / `dayGateEnabled`
   computation and imports from `src/app/vault/flights/[id]/placemat/route.ts`.
3. **Rescue #145:** update from `main`, resolve the browse-landing conflict in
   favor of `main` (#156), re-run the green gate, get it merged. It is carrying
   finished content work that is aging.
4. **Land `main`.** It is 2+ weeks stale and everything above is queued behind it.
5. **Then** start Phase 2a passport: `GuestTasting` (+ `stampedDayKey`), migration
   on **demo only**, stamp Server Action in `src/app/vault/actions.ts`, passport
   view. Spec is written; no design work needed.

---

## 8. Green gate (all must pass before any push)

```bash
npm.cmd test -- --run src/lib/spirit-vault   # focused
npm.cmd test                                 # full suite
npx tsc --noEmit
npm.cmd run build
```

As of `99c27f0`: spirit-vault 98/98, full suite 445/445, tsc clean, build clean.
CI on `main` enforces Typecheck / Test / Build + Codex Review, strict and
up-to-date, `enforce_admins` on. Red blocks the merge for everyone.

---

## 9. Docs worth reading, in priority order

| Doc | Why |
|---|---|
| `docs/spirit-vault/PHASE2-GUEST-LAYER-SPEC.md` | Guest layer + **§6 the stamp rule (new)** |
| `docs/spirit-vault/DRAFT-CONTENT-AUDIT.md` | All 91 drafts tiered; open questions for Sean |
| `docs/spirit-vault/NEXT-SESSION-HANDOFF.md` (#161) | Prior cold-start handoff — **partly stale**, predates everything in §3 |
| `docs/spirit-vault/FLIGHT-BUILDER-ASAP-BUILD-PLAN.md` (#159) | The plan #162/#163 diverged from |
| `docs/spirit-vault/SPIRIT-SCHEMA-SPEC.md` | Canonical spirit model |

---

## 10. Still open, needs Sean — not us

1. **#162 or #163?** Blocks the entire flight-builder lane.
2. **Flavored / house vodkas** — dossiers or shelf-only? Blocks 8 draft records.
3. **Jose Cuervo** — which SKU is on the shelf?
4. **Apostoles Rosa** — which product, and is it even agave?
5. **Moko Dark** — Toast says `Maison Peryat`, shelf says `Maison Ferrand Plantation`.
6. **Herradura Ultra** — if it is the Ultra Añejo Cristalino it is misfiled under `blanco-silver`.
7. **Ketle Vodka** — venue spelling stays, but is the bottle Ketel One?
8. **Flavor radar** — will Sean taste through Batch 2 and set the axes, or does the
   radar stay hidden on those records?
