# Codex review brief — PR #146 (Sean's answers to the Spirit Vault audit questions)

**Repo:** `seanaustin1-rgb/restaurant-os`
**Branch:** `claude/previous-session-continuation-ls0rka` → base **`feat/spirit-vault-draft-loader`** (PR #145, not `main`)
**PR:** #146 · commits `b2ee812` (decisions) + the engine-validator fix below, on top of #145's `7bb3ea1`
**CI:** green — Typecheck ✅ Test ✅ (461/461) Build ✅. The Codex Review job's own log
shows `You have no credits remaining` on the OpenAI API; it has failed that way on every
push to #145 and #146 alike and is not a signal about this diff.

**Read first:** `AGENTS.md`, `CLAUDE.md`, `docs/spirit-vault/DRAFT-CONTENT-AUDIT.md`
(the decision table at the top is the spec this PR implements),
`docs/spirit-vault/CODEX-PHASE2-HANDOFF.md` (Claude Lane scope).

## What this PR is

Content/decision encoding only. Sean answered the seven open questions in
`DRAFT-CONTENT-AUDIT.md`; this commit writes those answers into the corpus.

**No migration, no importer `--apply`, no DB write, no schema change, no runtime
wiring, no new dependency.** Two new *authoring helpers* in a docs-directory data
file, plus test updates.

### Verified blast radius

Transformed both branches through `guestRecordToRows()` and diffed the resulting
`definition` / `venueSpirit` / `offers` rows for all 200 records:

| Metric | Result |
|---|---|
| Records with any changed field | **12 of 200** (188 byte-identical) |
| Slug changes | **0** — all 200 slugs identical to base |
| `recordStatus` / `publicationStatus` changes | **0** |
| `verificationStatus` changes | **0** (all 12 were and remain `UNSOURCED`) |
| `offers` (price / pour / Toast GUID) changes | **0** |

The zero-slug-change result is the one that matters operationally: the 12 records
moved from `DRAFT_INVENTORY_ROWS` into two new arrays, and an id change would have
made the next importer `--apply` **insert duplicates** into `outfront-demo` rather
than update in place. Each moved record now passes an explicit `id:` rather than
relying on `draftSlug(displayName)` derivation. Worth re-checking independently.

The 12 changed records and their changed fields:

- **Identity confirmed (4):** `jose-cuervo-tequila`, `herradura-ultra-blanco`,
  `ketle-vodka`, `apostoles-rosa` — `brand` / `expression` / `subcategory` /
  `category` / `style` / `production` / `prodTags` / `why` / `whyShort` /
  `sourcingLimitations` / `venue.notes`
- **Shelf-only (8):** the house + flavored vodkas — same set plus `topNotes`

## Files changed (7)

1. `docs/spirit-vault/spirit-vault-data.js` — two new helpers
   (`identityConfirmedDraft`, `shelfOnlyListing`), 12 rows moved out of
   `DRAFT_INVENTORY_ROWS` into `IDENTITY_CONFIRMED` (4) and `SHELF_ONLY` (8),
   both appended to the returned array.
2. `src/lib/spirit-vault/sourced-drafts.test.ts` — `HELD_HOUSE_VODKA_IDS` →
   `SHELF_ONLY_IDS` with new assertions; new `IDENTITY_CONFIRMED` map + tests;
   `HELD_IDENTITY_IDS` narrowed to the still-unresolved Moko Dark.
3. `src/lib/spirit-vault/transform.test.ts` — scaffold count 64 → 52; new
   assertions that the four groups still sum to the original 90 and that neither
   new state advances publication; the Toast catch-all is now asserted **empty**.
4. `docs/spirit-vault/DRAFT-CONTENT-AUDIT.md` — decision table, the two new record
   states, revised tallies, and the blocked-question writeup.
5. `docs/spirit-vault/CODEX-PHASE2-HANDOFF.md` — session state + the blocker.
6. `docs/spirit-vault/spirit-vault-prototype.html` — the engine-validator fix
   (see "Added after review" below). The only guest-engine change in this PR.
7. `src/lib/spirit-vault/engine-validator.test.ts` — **new**; runs the engine's own
   validator over the real corpus, which nothing did before.

## The two new record states

**`identityConfirmedDraft()` — identity confirmed, facts still unsourced.** Sean
read the bottle at the shelf. That sources *which product it is* and nothing else,
so these keep `verificationStatus: 'unverified'`, cite zero sources, and carry a
limitation reading "an identity confirmation is not a source" for
producer/origin/strength/production. Display names deliberately unchanged — the
venue's shelf label stays the shelf label; real identity goes to `brand`/`expression`.

**`shelfOnlyListing()` — listed, never dossiered.** The 8 house/flavored pours stay
on the shelf so the menu reads complete but carry no producer, no tasting notes,
no sources, and none of the scaffold's "pending source review" copy (which would
imply a review Sean has explicitly closed).

## Prioritize

1. **Slug preservation / importer idempotency** — confirm independently that no
   moved record's id drifted, and that `IDENTITY_CONFIRMED` + `SHELF_ONLY` being
   concatenated *after* `DRAFT_INVENTORY` can't shadow or duplicate a row. An
   error here corrupts the demo DB on the next `--apply`.
2. **Nothing became guest-visible** — every touched record must remain
   `DRAFT`/`DRAFT`/`UNSOURCED`. Both new helpers build on `draftInventorySpirit`,
   which sets those; confirm neither helper overrides them on any path.
3. **`topNotes: null` on the 8 shelf-only records, and the engine change it forced**
   *(the part I'm least sure about)* — `null` was originally chosen to mean "no
   notes, ever". It turned out the engine validator rejected it outright, which is
   how the P2 below surfaced; the validator is now explicitly exempted for drafts
   rather than the record relying on a falsy-check quirk. Still worth a second
   opinion on the representation itself: is `null` right for "no notes, ever", or
   should shelf-only pours carry three placeholders and accept the misleading
   review-queue signal? `transform.ts` maps null → `[]` for the DB, and
   `validate.ts`'s publish gate still demands exactly 3.
4. **Invented taxonomy strings** — `subcategory: 'gold-joven'` (new) and
   `cat: 'Gin'` (new category, currently a category of one). Neither is enum-backed;
   `silo` stays null for both (the cat→silhouette mapper is still Phase 1.5). Sanity
   check: does any consumer — admin list grouping, filter chips, the importer —
   assume a closed set of categories or subcategories? Both records are hidden
   drafts, so guest impact today should be nil (`isGuestVisible` + the
   `publishedVaultListingArgs` PUBLISHED/PUBLISHED filter), but confirm.
5. ~~**A static/DB inconsistency I chose to flag rather than fix**~~ — **RESOLVED,
   see below.** Codex reviewed this and correctly widened it: the defect was not
   limited to shelf-only pours. Fixed in `d0e5b4b`.

## Added after review: the engine-validator fix (Codex's P2 on #145)

Codex left an unresolved **P2** review thread on #145 saying draft records fail the
prototype's own validator. **Verified — it is real, and worse than reported.** The
engine runs `validateSpiritRecords(ALL_BOTTLES)` over *all* records at startup and
escalates to a hard throw on dev hosts (`location.protocol === 'file:'` or
localhost), so opening the prototype locally threw before rendering a single bottle.
Production only `console.error`s, so the live vault was never affected.

Reproducing the engine's blank-check predicate over the real corpus found **72
failures across 3 causes**:

| Cause | Records | Origin |
|---|---|---|
| `reviewedAt: null` on drafts | 64 | pre-existing (#145 and earlier) |
| `topNotes: null` on shelf-only pours | 8 | **introduced by this PR** |
| `topNotes.length !== 3` (Malibu 1, Myers's Dark 2) | 2 | pre-existing (Batch 2) |

The third is a genuine rule conflict already in the repo: `sourced-drafts.test.ts`
deliberately permits a short note list when it declares itself (recording only the
descriptors a producer actually publishes, rather than padding to three), while the
engine demanded exactly three of every record. Malibu and Myers's Dark could
therefore never have rendered locally or published.

**Fix (2 edits, both in `spirit-vault-prototype.html`, both gated on
`recordStatus === 'draft'`):**

1. `DRAFT_OPTIONAL_FIELDS = ['reviewedAt','topNotes']` — exempt from the blank check
   for drafts only. A draft has not been reviewed, so a review date would be a lie;
   and a record with no tasting notes must be able to say so with `null` instead of
   three placeholders implying notes are coming.
2. The exactly-3 `topNotes` rule now applies only to non-drafts.

**Guest safety is unchanged and worth confirming in review:** both exemptions key on
`recordStatus === 'draft'`; published records still require every field and exactly
three notes; `isGuestVisible()` still requires *both* statuses to be `published`; and
`validate.ts` independently gates publication on exactly three notes. The loosening
cannot reach a guest.

**The real gap was test coverage** — nothing exercised the engine's validator, which
is how a bug that breaks local rendering of the entire vault shipped with a 100%
green suite. `src/lib/spirit-vault/engine-validator.test.ts` now extracts the real
validator source (not a reimplementation, so it cannot drift) and runs it over the
real corpus, including a case asserting the local/`file://` path does not throw and
one asserting published records are still held to the strict rules.

**Worth a reviewer's judgment:** this touches the guest engine, which the rest of
this PR deliberately avoided. It was done because the bug was real, Codex
recommended exactly this fix, and 8 of the 72 failures were introduced here. If Sean
would rather the engine stay untouched, the alternative is giving the 8 shelf-only
pours three placeholder notes — which reintroduces the "review coming" implication
his shelf-only decision closed.

## Codex round 2 — the inferred-distillery P2 (fixed)

Codex reviewed `be27f46` and returned one P2, which was **item 5 above, but broader
and sharper than I had framed it**. I had described it as a shelf-only cosmetic
mismatch. Codex correctly identified it as a self-contradiction affecting both new
states:

> `draftInventorySpirit(config)` inherits `makeBatchSpirit`'s brand-based values, and
> `guestRecordToRows()` imports those structured fields instead of the top-level
> `record.distillery`. Consequently the four identity-only records assert their newly
> confirmed brands as distilleries, while all eight shelf-only records assert a
> distillery named `House`.

Verified — the DB rows read exactly that:

| Record | `distilleryName` written to the DB (before) |
|---|---|
| `ketle-vodka` | `Ketel One` |
| `jose-cuervo-tequila` | `Jose Cuervo` |
| `herradura-ultra-blanco` | `Herradura` |
| `apostoles-rosa` | `Príncipe de los Apóstoles` |
| the 8 shelf-only pours | `House` |
| the 52 plain scaffold rows (pre-existing, #145) | `Milagro`, `Zumbador`, … |

The identity-confirmed case is the worst of the three: those records carry a
limitation reading *"an identity confirmation is not a source"* for producer and
origin, while simultaneously writing the confirmed brand into the DB as a
distillery. A brand is not a distillery — Ketel One's is Nolet, Herradura's is NOM
1119 — so this was the vault asserting an unsourced production fact.

**Fix (`d0e5b4b`):** cleared `distilleryName` and `dist.name` in
`draftInventorySpirit`, the shared base, rather than in the two new wrappers. That
corrects all **64** draft-inventory records in one place — the 12 from this PR plus
**52 pre-existing rows from #145** carrying the same false claim. `distilleryName`
is nullable in Prisma and `validate.ts` never reads it, so nothing else moves. The
top-level `distillery` *display* string stays non-blank (`"<brand> - Origin
pending"`, or "House pour - no producer claimed") because the engine's
`REQUIRED_SPIRIT_FIELDS` includes it.

Guarded by three new assertions in `sourced-drafts.test.ts` covering all 64 records:
structured distillery fields null, display string non-blank, and the count itself.

**Note for the reviewer:** this widens the PR's blast radius from 12 changed records
to 64. The extra 52 are a strict correction — a false distillery claim removed — but
they are #145's rows, so say if you would rather have this scoped to the 12.

## Explicitly NOT in this PR

- **The flavor radar (audit question 7).** Sean asked for axes derived from
  published tasting notes; the session container's egress blocks every producer and
  reference domain, and writing axis values from a search snippet while citing a
  page nobody opened is the failure mode this lane exists to prevent. Deferred to a
  session with web access, and documented as blocked rather than silently skipped.
- Consequently **all 26 Batch-2 sourced drafts still share one identical scaffold
  radar** (`Sweet:5 Oak:5 Spice:5 Fruit:4 Smoke:1 Earth:3 Herbal:2`, body/finish 5).
  Not a regression from this PR — pre-existing, and now written down.
- **Moko Dark stays held** — the shelf label (`Maison Ferrand Plantation`) and the
  Toast label (`Maison Peryat`) still disagree and Sean could not resolve it.

## Two known deferrals — confirm acceptable, do not fix now

- The engine cannot express **"radar not set"** at all: its validator requires all
  seven axes to be finite numbers 0–10, so an untasted record is indistinguishable
  from a profiled one. Giving the radar an absent state is an engine change and is
  out of the Claude Lane for this pass.
- `Gin` has no silhouette mapping and no sibling records; the gin shelf is unbuilt.

## Output

Concrete, actionable findings with `file:line` references; if it's clean, say so.
**Do NOT run the importer, any migration, or any DB write.** The 200/109/91 dry-run
gate on #145 still governs everything downstream.
