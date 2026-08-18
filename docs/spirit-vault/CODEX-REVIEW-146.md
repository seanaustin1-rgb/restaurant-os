# Codex review brief — PR #146 (Sean's answers to the Spirit Vault audit questions)

**Repo:** `seanaustin1-rgb/restaurant-os`
**Branch:** `claude/previous-session-continuation-ls0rka` → base **`feat/spirit-vault-draft-loader`** (PR #145, not `main`)
**PR:** #146 · single commit `b2ee812` on top of #145's `7bb3ea1`
**CI:** green — Typecheck ✅ Test ✅ (454/454) Build ✅. The Codex Review job's own log
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

## Files changed (5)

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
3. **`topNotes: null` on the 8 shelf-only records** *(the change I'm least sure
   about)* — the engine validator in `spirit-vault-prototype.html` reads
   `if(spirit.topNotes && spirit.topNotes.length !== 3)`. `null` passes only
   because it is **falsy**; an empty array `[]` would fail (truthy, length 0).
   That is a real coupling to a falsy-check. Is `null` the right representation
   for "no notes, ever", or should these carry three placeholders after all and
   accept the misleading queue signal? `transform.ts` maps null → `[]` for the DB,
   and `validate.ts`'s publish gate still demands exactly 3 — fine only because
   these never publish.
4. **Invented taxonomy strings** — `subcategory: 'gold-joven'` (new) and
   `cat: 'Gin'` (new category, currently a category of one). Neither is enum-backed;
   `silo` stays null for both (the cat→silhouette mapper is still Phase 1.5). Sanity
   check: does any consumer — admin list grouping, filter chips, the importer —
   assume a closed set of categories or subcategories? Both records are hidden
   drafts, so guest impact today should be nil (`isGuestVisible` + the
   `publishedVaultListingArgs` PUBLISHED/PUBLISHED filter), but confirm.
5. **A static/DB inconsistency I chose to flag rather than fix** — for shelf-only
   records I set `record.distillery = 'House pour - no producer claimed'`, which is
   the *display* string used by the static guest payload. `transform.ts` builds the
   DB row's `distilleryName` from `r.distilleryName ?? r.dist?.name`, which resolves
   to the brand `'House'` — so the DB asserts a distillery literally named "House"
   while the static record says no producer is claimed. Is `'House'` acceptable
   there, or should `distilleryName` be null for a well pour?

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
