# Spirit Vault — Draft Content Audit (agave / rum / vodka)

**Date:** 2026-08-17 · **Branch:** `feat/spirit-vault-draft-loader` · **PR:** #145
**Scope:** the 91 hidden drafts in the 200-record corpus — 90 `DRAFT_INVENTORY_ROWS`
(43 agave / 24 rum / 23 vodka) plus `calumet-farm-8-year-bourbon` (out of scope here;
whiskey lane).

**Nothing in this pass is published.** Every record stays `recordStatus:'draft'` /
`publicationStatus:'draft'`. Counts are unchanged: 200 records, 109 guest-visible,
91 drafts. No importer `--apply`, no migration, no DB write.

---

## ✅ Sean's answers — 2026-08-18 (all seven open questions closed)

Every question at the bottom of this file has an answer. What each one changed in
`spirit-vault-data.js` is recorded here so the decision and its encoding stay together.

| # | Question | Sean's answer | Encoded as |
|---|---|---|---|
| 1 | Tier C flavored / house vodkas | **Shelf-only, no dossiers** | 8 records moved to `shelfOnlyListing()` — listed, no producer, no tasting notes, removed from the review queue |
| 2 | Jose Cuervo — which SKU? | **Especial Gold** | `identityConfirmedDraft()`, brand `Jose Cuervo` / expression `Especial Gold`, re-filed `toast-agave-draft` → new `gold-joven` |
| 3 | Apostoles Rosa — agave at all? | **It's the gin** | Moved out of Agave: `cat:'Gin'`, `subcategory:'gin'`, brand `Príncipe de los Apóstoles` |
| 4 | Moko Dark — which producer? | **Keep it held** | Unchanged. Still a factless draft; the shelf/Toast label conflict is unresolved |
| 5 | Herradura Ultra — the Cristalino? | **Yes** | Re-filed `blanco-silver` → `anejo-and-specialty`, expression `Ultra Añejo Cristalino` |
| 6 | Ketle Vodka — is it Ketel One? | **Yes** | Brand `Ketel One`; venue display spelling `Ketle Vodka` kept per Sean, mismatch logged |
| 7 | Flavor radar | **Derive from published tasting notes** | ⚠️ **Not done — blocked.** See below |

### Two new record states

Sean's answers describe states the draft scaffold could not express, so both are now
explicit rather than implied:

- **`identityConfirmedDraft()` — identity confirmed, facts still unsourced.** Sean read
  the bottle at the shelf, so we know *which product* a row is. That sources the identity
  and nothing else: producer, origin, strength and production stay `unverified`, cite
  nothing, and carry a limitation saying an identity confirmation is not a source for
  them. Only `brand` / `expression` / `subcategory` / `cat` moved. Display names are
  deliberately unchanged — the venue's shelf label stays the shelf label.
- **`shelfOnlyListing()` — listed, never dossiered.** The 8 house/flavored pours keep
  their place on the shelf so the menu reads complete, but carry no producer, no tasting
  notes (`topNotes: null`, not three placeholders) and no "pending source review" copy.
  Leaving the scaffold language on them would have parked them in a review queue Sean
  has explicitly closed.

### ⚠️ Question 7 (flavor radar) is BLOCKED, not skipped

Sean asked for the radar axes to be derived from tasting notes found online. **That work
could not be done in this session: the container's network egress blocks every producer
and reference domain** (`herradura.com`, `cuervo.com`, `ketelone.com`, `diffordsguide.com`,
even Wikipedia all fail through the proxy). Web *search* returns summaries, but writing
axis values from a search snippet — while citing a producer page nobody opened — is
precisely the failure mode the rest of this audit exists to prevent.

**What the next session should know:**

- All 26 Batch-2 sourced drafts still carry the **identical** scaffold radar
  (`Sweet:5, Oak:5, Spice:5, Fruit:4, Smoke:1, Earth:3, Herbal:2`, body 5, finish 5).
  Malibu and Herradura Añejo currently render the same shape. These are
  `makeBatchSpirit` defaults, not tasting profiles.
- 11 of the 26 already carry cited tasting descriptors in `topNotes`; 15 have none and
  need fresh producer sourcing.
- **Structural finding worth Sean's decision:** the engine *requires* all seven axes to
  be finite numbers 0–10 (`spirit-vault-prototype.html`, the `FLAVOR_AXES` loop in the
  record validator), so there is no way to express "this radar is not set". A record
  with no tasting data is therefore indistinguishable from one with a real profile.
  Giving the radar a nullable/absent state is an engine change, out of lane for this
  pass — flagged rather than done quietly.

### Tally after these decisions

Tier A 57 + Tier B 21 + identity-confirmed 4 + shelf-only 8 = the 90
`DRAFT_INVENTORY_ROWS`. Category split is now **42 agave / 24 rum / 23 vodka / 1 gin**
(Apostoles Rosa left the agave count).

---

## Legend

| Tier | Meaning |
|---|---|
| **A — source-ready** | Product identity is unambiguous and producer/reference sources publish the facts we need (producer, origin, strength, aging). Safe to build a sourced dossier now. |
| **B — needs identity confirmation** | The shelf/Toast label does not map 1:1 to a single confirmable SKU, or the brand is small enough that no citable source publishes specs. Facts must not be written until the SKU is pinned. |
| **C — house / shelf-only hold** | Sean has not decided whether these get guest dossiers at all. Do not build content. |

---

**Tally (as first audited, 2026-08-17):** Tier A 57 + Tier B 25 + Tier C 8 = the 90
`DRAFT_INVENTORY_ROWS` (43 agave / 24 rum / 23 vodka). See the 2026-08-18 decisions
above for the current split.

## Tier A — source-ready (57)

### Agave (28)
Casamigos Blanco · Casamigos Reposado · Casamigos Anejo · El Jimador Silver ·
El Jimador Reposado · El Jimador Añejo · Herradura Silver · Herradura Reposado ·
Herradura Añejo · Patrón Silver · Don Fulano Reposado · Don Fulano Anejo ·
1800 Silver · 1800 Reposado · 1800 Anejo Tequila · Milagro Silver ·
Milagro Reposado · Mi Campo Blanco · Mi Campo Reposado · Tres Agaves Organic Blanco ·
Agavales Reposado · Adictivo Reposado · Terralta Reposado · El Luchador Blanco ·
El Luchador Reposado · 21 Seeds Cucumber Jalapeno · 123 Organic Anejo ·
El Jimador Cristalino †

† `El Jimador Cristalino` is a real SKU but the row's style line says "Filtered Añejo" —
confirm whether the bottle on the shelf is the reposado-based or añejo-based cristalino
before writing the aging line.

### Rum (19)
Bacardi White (SKU = BACARDÍ Superior) · Bacardi Dragonberry ·
Captain Morgan Original Spiced · Captain Morgan Private Stock · Malibu ·
Gosling's Black Seal · Myers's Dark (SKU = Myers's Original Dark) · Bumbu Dark ·
Kasama Small Batch 7 Year · Angostura White Oak · Don Q 151 ·
Don Q Gran Reserva Añejo XO · Don Q 2x Aged Cognac Cask · Zaya Gran Reserva 16 Year ·
Diplomatico Mantuano Dark · Ron Botran Reserva #12 · Ron Barceló Imperial ·
Planteray 3-Star · Papa's Pilar Blonde

### Vodka (10)
Absolut Vodka · Grey Goose Vodka · Tito's Vodka · Belvedere Vodka ·
Chopin Potato Vodka · Haku Vodka · Boyd & Blair Potato Vodka · Double Cross Vodka ·
Stoli Vodka · Vodka Grey Whale (SKU = Grey Whale Vodka; venue spelling kept per Sean)

---

## Tier B — needs identity confirmation (21 records — 4 resolved 2026-08-18, see above)

| Record | What has to be pinned first |
|---|---|
| `Maison Ferrand Plantation Moko Dark` | **Known hold.** Plantation rebranded to Planteray; "Moko" needs a producer/source check before any rename or fact. Toast label reads `Maison Peryat Moko Dark`. |
| `Aman Tequila Blanco` | Small brand; no citable producer spec sheet found. |
| `Santaleza Blanco` | Same. |
| `Rey Supremo Rosa` | Confirm expression and whether "Rosa" means a wine-barrel finish. |
| `Zumbador Blanco` / `Zumbador Reposado` / `Zumbador Añejo` | Sean-confirmed venue names; producer/NOM not yet sourced. The Añejo row claims ex-Jack Daniel's barrels — needs a source. |
| `Skelly Reposado` | Small brand; confirm producer/NOM. |
| `Tita Doña Celia Reposado` | Confirm producer/NOM; the "woman-owned / Jalisco" claim needs a source. |
| `Don Ramón Reposado Punta Diamante` / `Don Ramón Añejo Punta Diamante` | Brand identity fixed by Codex; still need producer/NOM and the Punta Diamante spec. |
| `Fosforo Mezcal` | Confirm maestro mezcalero, agave species, village. |
| `Granja Nómada` | Toast label `Granja 100% Maguey`; confirm expression and agave species. |
| `Hidden Still Spiced` | PA craft producer — confirm the exact rum expression and proof. |
| `Papa's Pilar Dark Rye Barrel` | Confirm this is the current rye-cask release and not a limited edition. |
| `Papa's Pilar Sherry Cask` | Same — confirm the current SKU name. |
| `Planteray Pineapple Rum` | Confirm whether this is Stiggins' Fancy Pineapple under the Planteray name. |
| `Amsterdam Apple Vodka` | Confirm this is New Amsterdam Apple. |
| `Holla Vodka` / `Apple Holla Vodka` | Confirm producer; may be a house/well pour rather than a brand. |
| `Prairie Cucumber Vodka` | Confirm this is Prairie Organic Cucumber. |

---

## Tier C — house / flavored pours (8) — **DECIDED 2026-08-18: SHELF-ONLY**

`House Vodka` · `Strawberry Vodka` · `Raspberry Vodka` · `Vodka Blueberry` ·
`Vodka Peach` · `Vodka Caramel` · `Vodka Orange` · `Whipped Vodka`

Well / flavored pours with no single confirmable producer. **Sean's decision: they stay
listed on the shelf and never get a guest dossier.** Built through `shelfOnlyListing()`;
no producer, no tasting notes, no sources, and none of the "pending source review"
language that would imply work still to come. No content written. No identity guessed.

---

## What this pass actually built (Batch 2 — sourced drafts)

26 Tier-A records were promoted from row-driven placeholders to canonical
`sourcedDraftSpirit({...})` records with cited facts. They remain **draft/hidden**.

**Agave (12):** Herradura Silver, Herradura Reposado, Herradura Añejo,
El Jimador Silver, El Jimador Reposado, El Jimador Añejo, Casamigos Blanco,
Casamigos Reposado, Casamigos Anejo, Patrón Silver, Don Fulano Reposado,
Don Fulano Anejo

**Rum (8):** Bacardi White, Captain Morgan Original Spiced, Malibu,
Gosling's Black Seal, Myers's Dark, Don Q 151, Zaya Gran Reserva 16 Year,
Diplomatico Mantuano Dark

**Vodka (6):** Absolut Vodka, Grey Goose Vodka, Tito's Vodka, Belvedere Vodka,
Chopin Potato Vodka, Haku Vodka

### Rules held on every one of them

- `recordStatus` / `publicationStatus` stay `draft`. `verificationStatus` moves to
  `source-reviewed` — that describes the **facts**, not permission to publish.
- The record `id` (slug) is unchanged, including the two preserved import slugs
  `casa-amigos-80pf` and `belvidere-vodka`, so the importer updates in place.
- `displayName` is **not** renamed. Where the shelf label differs from the real SKU
  (`Bacardi White` → BACARDÍ Superior, `Myers's Dark` → Myers's Original Dark,
  `Casamigos Anejo` missing its tilde) the correct product identity goes in
  `brand` / `expression` and the mismatch is recorded in `sourcingLimitations`.
- `whyWeCarry`, `seanShort` and `notes` stay **"Pending Sean review."** — venue voice
  is his.
- `flavor` / `body` / `finish` are left as **unsourced placeholders**, and every record
  carries a `sourcingLimitations` line saying so. A flavor radar is a tasting judgment,
  not a fact; it needs Sean's palate, not a web search.
- `topNotes` are real only where a producer or cited reference publishes tasting
  descriptors. Otherwise they read `Pending source review` — never invented.
- `priceUsd` and `toastItemGuid` are carried through untouched from the Toast pull.

---

## Open questions for Sean — ✅ ALL ANSWERED 2026-08-18

> Answers and their encoding are in the decision table at the top of this file.
> Kept below for the reasoning behind each question.

1. **Flavored / house vodkas (Tier C):** dossiers or shelf-only? Blocks 8 records.
2. **Jose Cuervo:** which SKU is actually on the shelf?
3. **Apostoles Rosa:** which product, and does it belong in the agave list at all?
4. **Moko Dark:** who is the producer? The Toast label (`Maison Peryat`) and the shelf
   label (`Maison Ferrand Plantation`) disagree.
5. **Herradura Ultra:** is the bottle the Ultra Añejo Cristalino? If so it is misfiled
   under `blanco-silver`.
6. **Ketle Vodka:** keeping the venue spelling is fine — but is the bottle Ketel One?
   Facts can't be written until that is a yes.
7. **Flavor radar:** do you want to taste through Batch 2 and set the seven axes, or
   should the radar stay hidden on these records until you do?
