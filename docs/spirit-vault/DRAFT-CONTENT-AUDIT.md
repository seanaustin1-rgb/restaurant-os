# Spirit Vault — Draft Content Audit (agave / rum / vodka)

**Date:** 2026-08-17 · **Branch:** `feat/spirit-vault-draft-loader` · **PR:** #145
**Scope:** the 91 hidden drafts in the 200-record corpus — 90 `DRAFT_INVENTORY_ROWS`
(43 agave / 24 rum / 23 vodka) plus `calumet-farm-8-year-bourbon` (out of scope here;
whiskey lane).

**Nothing in this pass is published.** Every record stays `recordStatus:'draft'` /
`publicationStatus:'draft'`. Counts are unchanged: 200 records, 109 guest-visible,
91 drafts. No importer `--apply`, no migration, no DB write.

---

## Legend

| Tier | Meaning |
|---|---|
| **A — source-ready** | Product identity is unambiguous and producer/reference sources publish the facts we need (producer, origin, strength, aging). Safe to build a sourced dossier now. |
| **B — needs identity confirmation** | The shelf/Toast label does not map 1:1 to a single confirmable SKU, or the brand is small enough that no citable source publishes specs. Facts must not be written until the SKU is pinned. |
| **C — house / shelf-only hold** | Sean has not decided whether these get guest dossiers at all. Do not build content. |

---

## Tier A — source-ready (56)

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

### Rum (18)
Bacardi White (SKU = BACARDÍ Superior) · Bacardi Dragonberry ·
Captain Morgan Original Spiced · Captain Morgan Private Stock · Malibu ·
Gosling's Black Seal · Myers's Dark (SKU = Myers's Original Dark) · Bumbu Dark ·
Kasama Small Batch 7 Year · Angostura White Oak · Don Q 151 ·
Don Q Gran Reserva Añejo XO · Don Q 2x Aged Cognac Cask · Zaya Gran Reserva 16 Year ·
Diplomatico Mantuano Dark · Ron Botran Reserva #12 · Ron Barceló Imperial ·
Planteray 3-Star

### Vodka (10)
Absolut Vodka · Grey Goose Vodka · Tito's Vodka · Belvedere Vodka ·
Chopin Potato Vodka · Haku Vodka · Boyd & Blair Potato Vodka · Double Cross Vodka ·
Stoli Vodka · Vodka Grey Whale (SKU = Grey Whale Vodka; venue spelling kept per Sean)

---

## Tier B — needs identity confirmation (23)

| Record | What has to be pinned first |
|---|---|
| `Jose Cuervo Tequila` | **Known hold.** Especial Gold vs Especial Silver vs Tradicional — subcategory and every fact depend on the SKU. Currently parked in `toast-agave-draft`. |
| `Apostoles Rosa` | **Known hold.** Confirm the exact product (Apóstoles is better known as a gin); confirm whether this is a rosa / wine-cask tequila and which subcategory. Currently `toast-agave-draft`. |
| `Maison Ferrand Plantation Moko Dark` | **Known hold.** Plantation rebranded to Planteray; "Moko" needs a producer/source check before any rename or fact. Toast label reads `Maison Peryat Moko Dark`. |
| `Herradura Ultra Blanco` | Row is filed `blanco-silver` with style "Cristalino". The Herradura SKU is **Ultra Añejo Cristalino**. Confirm the bottle, then re-file. |
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
| `Ketle Vodka` | Venue spelling kept per Sean; the Toast label reads `Kettle One Vodka`, so this is almost certainly **Ketel One**. Confirm before writing Nolet / Schiedam facts. |
| `Prairie Cucumber Vodka` | Confirm this is Prairie Organic Cucumber. |

---

## Tier C — house / shelf-only hold (8) — **PENDING SEAN**

`House Vodka` · `Strawberry Vodka` · `Raspberry Vodka` · `Vodka Blueberry` ·
`Vodka Peach` · `Vodka Caramel` · `Vodka Orange` · `Whipped Vodka`

These are almost certainly well / flavored pours with no single confirmable producer.
Sean has not decided whether they get full guest dossiers or stay shelf-only.
**No content written. No identity guessed.**

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

## Open questions for Sean

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
