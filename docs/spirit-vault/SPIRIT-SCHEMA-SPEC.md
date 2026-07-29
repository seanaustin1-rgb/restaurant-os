# Spirit Vault — Historical Static-Record Schema Proposal

> **Superseded by PR #137 on 2026-07-29.** Do not implement this JavaScript
> object literally or treat it as the database contract. The canonical model is
> `SpiritDefinition → VenueSpirit → SpiritPour → SpiritPriceObservation` in
> `prisma/schema.prisma`; current decisions and migration state are in
> `HANDOFF.md`. This file remains useful as design provenance and a field-level
> consumer checklist.

**Date:** 2026-07-26 · **Status:** Historical proposal
**Derived from:** `DATA-AUDIT.md` (field inventory + debt register)

One canonical record per spirit. The current `SPIRIT_DATA` / `DOSSIER_DETAILS`
split becomes a single object (or is generated from one source); renderers and
future consumers (Flight Builder, placemats, training, Toast joins, eventual
OutFrontData module) all read this shape. Echo-first: nothing here builds the
cross-venue network or community features — it just avoids shapes that would have
to be torn up later.

## Ownership classes

Every field belongs to exactly one class:

1. **K — Knowledge** (Spirit Vault owns; true everywhere the bottle exists)
2. **C — Commerce** (Toast/POS owns; Vault stores a join + last-known values)
3. **V — Venue** (Echo's Reserve curation; another venue would differ)
4. **P — Provenance** (verification, review, sourcing metadata)
5. **D — Computed/display-only** (derived at render; **never stored**)

## Canonical record

```js
{
  schemaVersion: 'spirit-v1',
  id: 'penelope-barrel-strength',            // K · permanent slug, never reused
  recordStatus: 'draft' | 'reviewed' | 'published',   // P · gates guest visibility

  identity: {                                 // K
    brand: 'Penelope',
    expression: 'Barrel Strength',
    displayName: null,                        // optional override; default = brand + expression
    category: 'bourbon',                      // controlled vocab (see §Vocabularies)
    subcategory: 'kentucky-straight',         // controlled vocab per category
    imageKey: 'bourbon',                      // silhouette until real photography
    imageAsset: null,                         // future photo path
    styleLine: 'Four-Grain Straight Bourbon · Barrel Strength',  // display-facing summary line
  },

  origin: {                                   // K
    producer: 'Penelope Bourbon',
    distillery: 'MGP of Indiana',             // producer ≠ distillery when sourced
    city: 'Lawrenceburg',
    region: 'Indiana',
    country: 'USA',
    coordinates: { lat: 39.09, lng: -84.85 }, // numbers; ° formatting is display
    producerIds: { nom: null },               // e.g. NOM 1146 for tequila
    history: '…prose…',
    timeline: [ { sortYear: 2018, label: '2018', text: '…' } ],
    facts: ['…'],                             // K facts only; venue-voice facts move to venue.facts
  },

  strength: {                                 // K
    proof: 116.2,                             // number, once; display string is computed
    abv: 58.1,                                // computed-at-entry or stored, pick one — stored here
    batchVaries: true,                        // barrel-proof programs
    age: { text: '4–5 yr', minYears: 4, maxYears: 5, unaged: false },
  },

  flavor: {                                   // K
    axes: { Sweet:7, Oak:6, Spice:6, Fruit:5, Smoke:1, Earth:3, Herbal:2 },  // 0–10
    body: 7, finish: 7,                       // 0–10, validated
    topNotes: ['Caramel depth','Baking spice','Toasted oak'],   // exactly 3
  },

  production: {                               // K · structured, filterable
    baseMaterial: 'grain',                    // grain | agave | cane | other
    mashBill: { summary: 'Blend of three bourbon mash bills (four-grain)',
                components: ['corn','rye','wheat','malted-barley'] },
    fermentation: null,
    distillation: { method: 'column-and-doubler', stillType: 'column+doubler',
                    detail: 'MGP, Lawrenceburg IN' },
    maturation: { vessel: 'new-charred-american-oak', charLevel: 4,
                  entryProof: 120, finishCasks: [] },       // finishCasks: ['oloroso-sherry']
    finishType: null,                         // top-level filterable echo of finishCasks[0]
    filtration: 'non-chill-filtered',
    additives: null,                          // 'additive-free-verified' for agave
    methodTags: ['small-batch','cask-strength','batch-numbered'],  // controlled vocab
    displayRows: null,                        // OPTIONAL curated label/value rows for the drawer;
                                              // if null, renderer derives rows from fields above.
                                              // The `wide` layout flag is gone — renderer decides.
  },

  narrative: {                                // K
    whyItMatters: '…',                        // plain text; markup policy: none, or **bold** only
    whyShort: '…one sentence…',
  },

  recognition: {                              // P
    press: [{
      date: '2026-02-17',                     // ISO, from the source itself
      type: 'award' | 'score' | 'news' | 'heritage' | 'venue-event',
      source: "Echo's Reserve",
      sourceUrl: null,                        // REQUIRED for verified:true (except venue-event)
      title: 'Featured — Whiskey Dinner',
      summary: '…',
      verified: true,
      badge: true,                            // renders as a hero badge; replaces awards[]
      addedAt: '2026-07-26',
    }],
    // awards[] is DELETED — badges derive from press entries with badge:true
  },

  venue: {                                    // V · Echo's Reserve only
    whyWeCarry: '…',
    curatorNote: '…full Sean's Notes…',       // attribution rendered, not stored
    curatorCue: 'Ask for it neat. No lime, no salt.',   // quote text only
    pairings: [                               // fixed slots; icons live in the renderer
      { slot: 'cheese',      text: '…' },
      { slot: 'charcuterie', text: '…' },     // slots: cheese, charcuterie, entree,
      { slot: 'entree',      text: '…' },     //        dessert, cocktail (cocktail text may
      { slot: 'dessert',     text: '…' },     //        be 'Neat — …' when serve-neat)
      { slot: 'cocktail',    text: '…' },
    ],
    paths: {                                  // ref-first policy
      lighter:     [{ ref: 'chicken-cock-5-year' , why: '…' },          // in-vault: ref + why only,
                    { name: 'Old Grand-Dad 7 Year', d: '…', why: '…' }], // display data comes from the record
      similar:     [ … ],                     // freeform {name,d,why} allowed ONLY for
      adventurous: [ … ],                     // bottles not in the master database
    },
    merchandising: {                          // split out of old `status`
      flightEligible: true,
      reserveRoomOnly: false,
      eventTags: [],                          // e.g. ['feb-2026-whiskey-dinner']
    },
    facts: [],                                // venue-voice facts ("ask about the next one")
  },

  commerce: {                                 // C · POS-owned; Vault stores join + snapshot
    pourPriceUsd: null,                       // null until Sean's numbers / Toast join
    pourSizeOz: 2,
    availability: 'available' | 'low' | 'unavailable' | null,   // POS- or manager-supplied
    toastItemGuid: null,
    toastMenuItemGuid: null,
    toastLocationGuid: null,
    externalSku: null,
    externalProductUrl: null,
    lastSyncedAt: null,
  },

  provenance: {                               // P
    addedAt: '2026-07-25',
    updatedAt: '2026-07-26',
    reviewedAt: '2026-07-26',
    reviewedBy: null,                         // 'sean' when he signs off
    sources: [],                              // [{url|citation, coversFields:[…]}] for production/history claims
  },
}
```

## Computed / display-only — never stored (class D)

Proof display string (`'116.2'`), price display (`'$14'`), pour label
(`'2 oz pour'`), coordinate formatting (`39.09° N`), availability chip text
(derive from enum), badge chips (derive from press), flavor "leans"
(derive from axes), mini-radar geometry, `wide` layout decisions, stat tiles
where derivable (Est. year ← timeline; char ← maturation), nav index/dots.
The current `btb.stats` hand-picked tiles may remain as an optional venue
display list (`venue.statTiles`) if derivation proves too rigid — Codex's
call; either way they are display config, not knowledge.

## What each consumer reads

| Consumer | Sections used |
|---|---|
| Guest dossier (today) | identity, origin, strength, flavor, production, narrative, recognition, venue, commerce (price/availability), provenance.reviewedAt |
| Browse/filter + Flight Builder candidate search | identity.category/subcategory, origin.country/region/distillery, strength (proof, age.minYears), flavor (axes, body, finish), production (finishType, mashBill.components, methodTags, maturation.vessel), recognition (verified count), commerce (availability, price), provenance (addedAt, reviewedAt), flight-usage history (flight layer, not this record) |
| Comparisons/recommendations | flavor, strength, identity, venue.paths |
| Staff training / placemats | narrative, production, venue, flavor.topNotes |
| Toast join (future) | commerce.* only — **a POS sync must never touch K/V/P sections** |
| OutFrontData network (future, deferred) | K + P sections as-is; V and C stay venue-scoped. |

## Controlled vocabularies (define once, validate against)

- `category`: bourbon, american-whiskey, rye, scotch, irish, world-whisky, agave, gin, rum, other — reconcile with the full 164-bottle list in `echo-reserve.html` before data entry.
- `subcategory`: per category (e.g. agave → blanco, reposado, añejo, mezcal, cristalino). Seed from the v1 site's `sub` values.
- `pairings.slot`: cheese, charcuterie, entree, dessert, cocktail.
- `press.type`: award, score, news, heritage, venue-event.
- `methodTags`, `maturation.vessel`, `filtration`: grow-as-needed enum lists kept in one constants block.

## Migration map (current → canonical)

| Current | Canonical |
|---|---|
| `cat` / `silo` | identity.category (+ imageKey) |
| `name` | identity.brand + identity.expression |
| `distillery` string | origin.producer/distillery/city/region/country |
| `style` | identity.styleLine (+ subcategory/methodTags) |
| `proof` + `proofN` | strength.proof (number only) |
| `age` string | strength.age {text,minYears,maxYears,unaged} |
| `price`, `priceL` | commerce.pourPriceUsd, commerce.pourSizeOz |
| `status[]` | commerce.availability + venue.merchandising |
| `production` tuples | production.* structured (+ optional displayRows) |
| `prodTags` | production.methodTags (production only) / venue or press (marketing/heritage) |
| `awards` | recognition.press entries with badge:true |
| `compare` | **deleted** |
| `pairings` tuples | venue.pairings {slot,text} |
| `dist` | origin.* |
| `btb.stats` / `btb.facts` | derived tiles or venue.statTiles / origin.facts + venue.facts |
| `notes`, `seanShort` | venue.curatorNote, venue.curatorCue (quote only) |
| DOSSIER_DETAILS fields | folded into the single record |

## Non-goals

No user accounts, no community fields, no multi-venue keys, no wine/beer
attributes, no POS write-back, no recommendation-engine weights stored on the
record. The schema stays a knowledge record with clean joins.
