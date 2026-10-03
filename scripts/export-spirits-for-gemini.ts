/**
 * Export every VenueSpirit + its SpiritDefinition + pours as JSON, ready to
 * hand to Gemini for content population.
 *
 * Run:
 *   npx dotenv -e .env.local -o -- tsx scripts/export-spirits-for-gemini.ts
 *
 * Output: writes `spirits-export.json` to the repo root (gitignored).
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.venueSpirit.findMany({
    orderBy: [{ definition: { category: "asc" } }, { definition: { brand: "asc" } }],
    include: {
      definition: true,
      offers: {
        select: {
          pourSizeOz: true,
          priceUsd: true,
          pourLabel: true,
          isPrimary: true,
          availability: true,
        },
      },
    },
  });

  const spirits = items.map((vs) => {
    const d = vs.definition;
    const overrides = (vs.overrides ?? {}) as Record<string, unknown>;
    return {
      // ── Identifiers (DO NOT CHANGE — used to match back on import) ──
      venueSpirit_id: vs.id,
      definition_slug: d.slug,
      venue_slug: vs.slug,

      // ── Identity (pre-populated, read-only for Gemini) ──
      brand: d.brand,
      expression: d.expression,
      displayName: d.displayName,
      category: d.category,
      subcategory: d.subcategory,
      style: d.style,
      country: d.country,
      region: d.region,
      distilleryName: d.distilleryName,
      producerName: d.producerName,

      // ── Strength & age (pre-populated, read-only for Gemini) ──
      proofN: d.proofN ? Number(d.proofN) : null,
      proofDisplay: d.proofDisplay,
      ageText: d.ageText,
      minYears: d.minYears,
      maxYears: d.maxYears,

      // ── Current status ──
      recordStatus: vs.recordStatus,
      publicationStatus: vs.publicationStatus,

      // ── Pours (read-only context for Gemini) ──
      pours: vs.offers.map((p) => ({
        sizeOz: p.pourSizeOz ? Number(p.pourSizeOz) : null,
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
        label: p.pourLabel,
        isPrimary: p.isPrimary,
        availability: p.availability,
      })),

      // ══════════════════════════════════════════════════════════════
      // FIELDS GEMINI SHOULD POPULATE (current values shown; many are
      // null/default and need real content)
      // ══════════════════════════════════════════════════════════════

      // ── Sensory (venue overrides — 0 to 10 integer scale) ──
      body: (overrides.body as number | null) ?? d.body,
      finish: (overrides.finish as number | null) ?? d.finish,
      flavor: {
        Sweet: ((overrides.flavor as Record<string, number> | undefined)?.Sweet) ?? (d.flavor as Record<string, number> | null)?.Sweet ?? null,
        Oak: ((overrides.flavor as Record<string, number> | undefined)?.Oak) ?? (d.flavor as Record<string, number> | null)?.Oak ?? null,
        Spice: ((overrides.flavor as Record<string, number> | undefined)?.Spice) ?? (d.flavor as Record<string, number> | null)?.Spice ?? null,
        Fruit: ((overrides.flavor as Record<string, number> | undefined)?.Fruit) ?? (d.flavor as Record<string, number> | null)?.Fruit ?? null,
        Smoke: ((overrides.flavor as Record<string, number> | undefined)?.Smoke) ?? (d.flavor as Record<string, number> | null)?.Smoke ?? null,
        Earth: ((overrides.flavor as Record<string, number> | undefined)?.Earth) ?? (d.flavor as Record<string, number> | null)?.Earth ?? null,
        Herbal: ((overrides.flavor as Record<string, number> | undefined)?.Herbal) ?? (d.flavor as Record<string, number> | null)?.Herbal ?? null,
      },
      topNotes: ((overrides.topNotes as string[] | undefined) ?? d.topNotes ?? []),
      pairings: ((overrides.pairings as string[] | undefined) ?? (d.pairings as string[] | null) ?? []),

      // ── Editorial (on SpiritDefinition — shared knowledge) ──
      whyShort: d.whyShort,

      // ── Sean's voice (on VenueSpirit — venue-specific) ──
      whyWeCarry: vs.whyWeCarry,
      seanShort: vs.seanShort,
      notes: vs.notes,
    };
  });

  const outPath = resolve(__dirname, "..", "spirits-export.json");
  writeFileSync(outPath, JSON.stringify(spirits, null, 2));
  console.log(`Exported ${spirits.length} spirits → ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
