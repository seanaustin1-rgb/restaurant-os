# Future Direction — OutFrontData Beverage Module

**Status:** Binding long-term direction; Echo's Reserve remains the pilot.
**Updated:** 2026-07-29

## Product position

Spirit Vault is intended to become an optional OutFrontData.com beverage
module. A venue should be able to connect its POS and receive a ready-made
beer, wine, and spirits dashboard plus guest-facing experiences.

The shared network becomes more valuable as adoption grows:

- one canonical product definition can serve many venues;
- each venue keeps its own assortment, pricing, availability, curation, and
  guest relationships;
- deidentified cross-venue evidence may later support regional pricing,
  assortment, trend, and product-evaluation suggestions; and
- guests may eventually pay for access beyond a single venue.

Echo's Reserve proves the operating model first. Do not delay the Echo build
to implement the whole network.

## Platform boundaries

`SpiritDefinition` is the shared knowledge foundation.

`VenueSpirit`, `SpiritPour`, and price observations remain tenant-scoped.
Personal guest data never becomes shared product knowledge. Any future
benchmarking must be aggregated, deidentified, and governed separately from
venue operations.

Toast is the only current POS source. Keep connector contracts
provider-agnostic so Clover, Square, Lightspeed, SpotOn, or others can be added
without changing the knowledge model.

## Potential operator capabilities

- Ready-made beer, wine, and spirits catalog/dashboard after POS connection
- Category, velocity, margin, and availability views
- Regional and trend-informed pricing suggestions
- Assortment and menu coverage analysis
- Product and staff-training gaps
- Flight, event, and featured-pour performance
- Current pricing and availability synchronization
- Admin-controlled guest dossiers, print pieces, and outreach

## Potential guest capabilities

- Venue collection and current pours
- Dossiers, verified reviews, scores, medals, and tasting guidance
- Venue-curated comparisons, flights, and events
- Private tasting history and personal notes
- Certified tasting milestones and future rewards
- Optional cross-venue access when the business model is defined

## Architecture rules to preserve now

- Stable shared IDs for product definitions
- Structured, source-backed knowledge
- No duplicated dossier content in flights, placemats, training, or venues
- Strict separation of shared knowledge, tenant commerce, and personal data
- POS identifiers as external joins, not primary product identity
- Append-only price and reward/tasting event history
- Empty features remain hidden rather than requiring tenant-specific rebuilds
- Provider-agnostic POS and marketing boundaries

## Deferred

- Generalized POS onboarding beyond Toast
- Wine and beer expansion
- Cross-venue discovery and paid guest access
- Network pricing/assortment benchmarks
- Public or community tasting profiles
- Automated publication of external content

Revisit these after Echo's normalized database, importer, admin workflow, and
guest certification loop are operating reliably.
