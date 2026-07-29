# Spirit Vault — Current Handoff

**Authoritative as of:** 2026-07-29
**Owners:** Sean (product), Claude and Codex (implementation/review)

Read this file before changing Spirit Vault code, data, schema, imports, or UX.
This is the current operating truth. Older decisions remain available in Git
history; do not copy completed session logs back into this file.

## Current state

- PR **#137** is merged to `main` at `dbf41ae` and its normalized schema is
  canonical.
- Migration `20260728000000_add_spirit_vault` was applied to the isolated
  **outfront-demo** Supabase database on 2026-07-29 after a full roles, schema,
  and data backup.
- `prisma migrate status` reports the demo database is up to date.
- The four Spirit Vault tables were verified in Supabase:
  `SpiritDefinition`, `VenueSpirit`, `SpiritPour`, and
  `SpiritPriceObservation`.
- Those tables are intentionally empty. The legacy static source currently has
  **110 records: 108 guest-visible and 2 drafts** (`calumet-farm-8-year-bourbon`
  and `middle-west-straight-rye`).
- The active implementation lane is the first normalized-model importer. Do
  not begin the admin editor against an empty database.

## Canonical data model

- **`SpiritDefinition`** — shared bottle identity, producer facts, structured
  knowledge, recognition, provenance, and review state. It has no
  `restaurantId`.
- **`VenueSpirit`** — one venue's relationship to a definition: tenant-owned
  slug, publication state, curation, voice, merchandising, and overrides.
- **`SpiritPour`** — a venue-scoped sellable serving: pour size, current price
  snapshot, Toast/external identity, availability, and commerce provenance.
- **`SpiritPriceObservation`** — append-only historical prices for a pour.

`BeverageItem` is not a durable Spirit Vault model. Code previously written
against it may be reused only after mapping it to the four canonical models; a
temporary adapter or read view is acceptable during migration.

Keep knowledge global and commerce/curation tenant-scoped. Shared downstream
references use `SpiritDefinition.id`; venue listings and commercial offers
must retain composite tenant isolation. Guest comparisons may expose only
spirits carried and published by the active venue.

## Active next step — importer

Build the importer as a separate PR against the normalized model.

Required behavior:

1. Read the 110 committed guest records through the existing loader and
   transform.
2. Require an explicit target `restaurantId`; never infer or default a tenant.
3. Default to dry-run. Require a deliberate flag for writes.
4. Upsert idempotently so reruns do not duplicate definitions, listings,
   pours, or the first price observation.
5. Use a transaction for committed writes and fail closed on validation or
   tenant mismatch.
6. Preserve source-accurate provenance. Unknown fields stay null; the importer
   must not invent identity, verification, or source mappings.
7. Seed Echo's current Toast prices as **1.5 oz** pour observations. The future
   flight product uses **1 oz** pours; do not rewrite the source Toast price as
   though it were already a flight price.
8. Print a completion report with created, updated, unchanged, skipped, and
   failed counts for each canonical table.
9. Test dry-run, idempotency, tenant isolation, transaction rollback, and
   parity for all 110 records.

Run it first only against the confirmed non-production `outfront-demo`
database. Applying migrations or running write-mode imports remains an
operator action. No production database work is authorized by this handoff.

## Product truth to preserve

### Scope and platform

- Echo's Reserve is the pilot. Initially the guest catalog shows only what
  Echo and/or Stone Grille carries; empty categories or “drawers” are hidden.
- The long-term product is an optional **OutFrontData.com** beverage module:
  connect a venue's POS and receive a ready-made beer, wine, and spirits
  dashboard with regional/trend-informed pricing and merchandising insights.
- Toast is the only current source. Keep connector boundaries
  provider-agnostic so other POS systems can be added later.
- One shared definition should become more valuable as adoption grows; never
  duplicate bottle knowledge per venue.

### Guest access and certified tastings

- The iPad generates the initial QR. The guest continues on their own phone or
  device.
- Browsing may begin without an account. Login is required to request
  certification, retain tasting history, or save personal tasting notes.
- A logged-in guest may request bartender approval for a specific spirit or
  experience. The request survives until **11:59 PM America/New_York** that
  day so a busy bartender can approve it later.
- Bartender or manager approval creates the certified tasting. For now, record
  certified tastings without assigning rewards.
- Rewards/tokens and milestone benefits remain future policy. Preserve an
  extensible event ledger so a featured spirit can later earn a multiplier
  without rewriting tasting history.
- Well spirits are outside the Echo's Reserve certification program for now.

### Flights and pricing

- Flights are preset and curated, not assembled as a paid on-the-fly POS item.
  The system may recommend preset flights from both an optional taste survey
  and a guest's accumulated tasting profile.
- The guest does not have to complete the survey; it is suggested.
- The manager selects and publishes the final flights. Start with three clear
  recommendations, not a cockpit-style screen.
- Toast prices are based on a **1.5 oz** pour. Flight pricing will convert to a
  **1 oz** pour and then apply a manager-adjustable percentage:

  `flight base = Σ(Toast 1.5 oz price × 1 / 1.5)`

  `flight price = flight base × (1 + manager percentage)`

- The percentage must be editable for specials. Final payment/ring-in remains
  in Toast through preset flight menu items or the operating workflow chosen
  when Toast implementation begins. Do not build POS write-back now.

### Recognition and content

- Printed Brag Book entries stay concise: a numerical score when available and
  a medal/star visual for a verified medal.
- Digital dossiers may show the publication/competition, date, link, review
  detail, and source limitations.
- Verified scores, medals, awards, and media claims require a real source.
  Never invent dates, scores, awards, mash bills, ages, proofs, or venue facts.
- Silhouettes remain the default bottle imagery; managers may add image
  overrides.
- Empty sections do not render.
- Human content review is roughly quarterly. Automated source/media discovery
  may run monthly (first of the month or when an admin requests it), but never
  auto-publishes changes.

### Printing

- Standard tastings of 3–4 spirits use **8.5 × 11 in**.
- Special dinners use **8.5 × 14 in**.
- Keep the 2.5-inch spirit circles with the spirit name inside and the
  pertinent tasting details below; repeated content is acceptable.
- The busy-service goal is one-button printing to the single network printer,
  which selects paper size from the incoming document. Printer integration is
  deferred until its capabilities are confirmed.
- Keep published output history indefinitely unless storage becomes material.
  Abandoned drafts may be pruned after 12 months.

### Privacy and outreach

- Personal contact, account, and tasting-note data stays private.
- Individual feedback remains admin-only until Sean explicitly changes that
  policy. Future aggregate product “feel” may use deidentified feedback only
  after at least 10 contributions.
- Guests choose their marketing interests. Toast Marketing is the first email
  channel; keep the provider boundary open for Mailchimp or another provider.

## Static guest prototype

The current public preview remains:

`https://seanaustin1-rgb.github.io/restaurant-os/spirit-vault/spirit-vault-prototype.html`

`docs/spirit-vault/spirit-vault-data.js` is still the source for that static
preview until database-backed publishing replaces it. The page loads the data
file before its inline renderer and intentionally avoids `fetch`, so the HTML
and data file must deploy together.

Do not regress:

- guest visibility requires both `recordStatus` and `publicationStatus` to be
  `published`;
- stable-ID comparison and navigation;
- source-reviewed recognition only;
- hidden empty drawers;
- phone usability with no horizontal overflow at 320 px;
- category silhouettes and optional image overrides; or
- separation of knowledge from Toast-owned commerce.

## Shared Claude/Codex protocol

1. Read this file and the relevant implementation before starting.
2. Update only the current state, active lane, durable decisions, unresolved
   product questions, and completed commit/PR.
3. Do not paste transcripts, completed batch logs, temporary review prompts,
   or speculative schemas into this handoff.
4. When Sean changes a decision, replace the superseded statement instead of
   appending a contradictory one.
5. Use one implementation owner and one reviewer per PR; record the active lane
   here before overlapping work begins.
6. Reconcile this handoff before requesting merge.

## Deferred, not forgotten

- Guest accounts, tasting history, favorites, certification UX, tokens, and
  rewards outcomes.
- Admin editor, publication workflow, QR generator, bartender approval queue,
  flight manager, placemat generator, and network printing.
- Wine/beer expansion and additional POS connectors.
- Cross-venue guest access, paid network access, regional benchmarks, and
  broader OutFrontData recommendations.

These are product directions, not authorization to build them in the importer
PR.
