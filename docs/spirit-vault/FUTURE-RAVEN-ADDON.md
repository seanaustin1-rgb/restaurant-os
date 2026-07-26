# Future Direction — Raven Hospitality Beverage Add-On

**Status:** Deferred strategic direction. Do not divert the current Echo's Reserve build.
**Decision date:** 2026-07-26
**Primary product now:** Echo's Reserve Spirit Vault

## Decision

Build and prove the Spirit Vault for Echo's Reserve first.

Do not spend current product or engineering time building a public consumer community, a standalone social tasting network, or a Raven hospitality module. Preserve architectural compatibility, but keep present execution focused on Echo's Reserve.

After Raven is built, has active hospitality users, and has a working connector framework, the beverage system may become a paid Raven upgrade.

## Future Raven position

The future product should be a paid hospitality add-on rather than the initial core of Raven.

Working description:

> Raven Beverage Intelligence is an optional hospitality module that joins POS commerce data with a structured beverage knowledge database to power operator dashboards and guest-facing beverage experiences.

Potential supported categories:

- Spirits
- Wine
- Beer
- Cocktails
- Non-alcoholic beverages

## Future data relationship

```text
POS CONNECTOR
Toast / Clover / Square / Lightspeed / SpotOn / others

        |
        | menu item identity
        | price
        | availability / active state
        | sales and product mix
        v

BEVERAGE KNOWLEDGE ENGINE
structured spirits / wine / beer records

        |
        | flavor
        | production
        | region
        | pairings
        | recommendations
        | training
        | flights and events
        v

RAVEN HOSPITALITY ADD-ON
operator intelligence + embedded guest experience
```

## Possible future Raven capabilities

For operators:

- Beverage mix and category trends
- Item velocity and margin analysis
- High-value bottles that are not moving
- Product and training gaps
- Staff recommendation patterns when source data permits
- Flight and event performance
- Menu coverage by flavor, category, region, proof, price, and style
- Stale or unavailable website listings
- Automatic synchronization of current pricing and availability

For guests through a venue's website or Raven-powered embedded page:

- Current spirit, wine, and beer collection
- Dossiers and tasting notes
- Venue-curated recommendations
- Flights and events
- Current price and availability where permitted
- Personal tasting history as a later optional layer

## Consumer/community thesis — deferred

There may be a future consumer layer for personal shelves, tasting journals, saved flights, following bartenders or guides, and community recommendations. The market is real but already competitive.

Do not treat this as the current business model. Revisit only after Echo produces evidence that guests repeatedly:

1. Save tastings or flights.
2. Return to their tasting history.
3. Follow or request recommendations from a bartender or curator.

A future community should be hospitality-led, not another generic bottle-rating network.

## Architecture rules to preserve now

Current Echo work should remain reusable without becoming overbuilt:

- Stable IDs for all beverage records
- Structured metadata rather than presentation-only prose
- Separation of commerce data from knowledge data
- POS identifiers stored as external references
- Source provenance and synchronization timestamps for imported data
- No duplicated dossier content in flights, training, placemats, or Raven
- API-ready boundaries even if the first release remains static
- Venue identity and tenant ownership must be possible later

## Explicit non-goals for the Echo build

Do not build now:

- Raven dashboard integration
- Multi-tenant hospitality infrastructure
- Consumer social feed
- Public influencer system
- Marketplace
- Cross-venue discovery
- Generalized connectors for every POS
- Wine and beer data merely to prove future breadth

## Revisit trigger

Revisit this document when all three are true:

1. Echo's Reserve Spirit Vault is in real guest use.
2. The Echo database and workflow are operationally maintainable.
3. Raven has hospitality users and a stable connector / add-on architecture.

Until then, mental and engineering priority remains the Echo's Reserve implementation.