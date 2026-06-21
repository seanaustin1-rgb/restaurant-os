# Benchmark ranges — rationale & FAQ answer

Where the "typical ranges" in the **You vs. industry** tile come from, and how to
defend them. The ranges are **static industry-consensus operating norms** for
full-service / casual-dining restaurants — not invented, not a live ranking
against other users, and not derived from any customer's data. They live in
`src/lib/modules/benchmarks.ts` (live app) and `src/lib/demo/estimate.ts` (demo).

## The ranges

| Metric | Typical band | Bands (green / yellow / red) |
|---|---|---|
| **Prime Cost** (food + labor) | 55–60% | ≤60% on-target · 60–65% watch · >65% high |
| **Food / COGS** | 28–32% | ≤32% on-target · ≤35% watch · >35% high |
| **Labor** | 28–34% | ≤34% on-target · ≤36% watch · >36% high |
| **Net Margin** | 3–9% | ≥6% healthy · 3–6% thin · <3% poor |

These are the same rules of thumb taught in restaurant management and used by
operators, bookkeepers, and consultants (echoed across National Restaurant
Association material, restaurant-accounting standards, and POS-vendor operator
guides). Prime cost under ~60% (danger zone above 65%), food cost around 30%,
labor around 30%, and thin single-digit net margins are uncontroversial in the
industry.

## FAQ answer (ready to publish)

> **Where do your industry benchmarks come from?**
>
> The ranges we compare you against are the long-standing operating benchmarks
> for full-service and casual-dining restaurants — the standards used across
> restaurant accounting and management:
> - **Prime cost (food + labor) under ~60%** — the single most-watched number in
>   the industry; above 65% is the widely recognized danger zone.
> - **Food / COGS ~28–32%** (the "30% rule"), with above 35% considered high.
> - **Labor ~28–34%**, with above 36% considered high.
> - **Net margin** — restaurants run thin: 6%+ is healthy, 3–6% is thin, under 3%
>   is a warning sign.
>
> These aren't numbers we made up, and they aren't a live ranking against other
> users — they're the established consensus norms operators and accountants
> already use. We show them as **guide-rails to orient you, not a precise score.**
> As we build an anonymized peer dataset, we'll replace these static ranges with
> real percentile comparisons against restaurants like yours.

## Why it's defensible (3 points)

1. **Industry consensus**, not proprietary guesses — anyone in the business
   recognizes them.
2. **Transparent** that they're static reference ranges, not live peer data.
3. Used as **green/yellow/red guide-rails**, never a false-precision number — so
   we never overclaim.

## Notes

- The **net-margin typical band is 3–9%** (full-service runs thin; an earlier
  6–12% read optimistic and was tightened for defensibility). The ≥6% = healthy
  threshold is unchanged.
- When a real cohort dataset lands, the static ranges swap out for percentiles
  with no UI change (the tile already renders from a `typicalLow/typicalHigh` +
  banding structure).
