/**
 * Publish Draft spirits by creating SpiritPour records and setting status to PUBLISHED.
 *
 * Reads `spirits-import.json` for pour pricing data, finds Draft VenueSpirit records
 * that have no priced offers, creates a primary SpiritPour for each, and sets both
 * recordStatus and publicationStatus to PUBLISHED.
 *
 * Spirits with null priceUsd in the import data are skipped (they need Sean to set
 * a price manually before they can become flight-eligible).
 *
 * DRY-RUN by default — prints what would change. Pass `--commit` to write.
 *
 * Run:
 *   npx dotenv -e .env.local -o -- tsx scripts/publish-draft-spirits.ts
 *   npx dotenv -e .env.local -o -- tsx scripts/publish-draft-spirits.ts --commit
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();
const commit = process.argv.includes("--commit");

interface ImportPour {
  sizeOz: number;
  priceUsd: number | null;
  label: string;
  isPrimary: boolean;
  availability: string | null;
}

interface ImportSpirit {
  venueSpirit_id: string;
  definition_slug: string;
  venue_slug: string;
  displayName: string;
  category: string;
  recordStatus: string;
  publicationStatus: string;
  pours: ImportPour[];
}

async function main() {
  console.log(`\n─── Publish Draft Spirits ${commit ? "(COMMIT)" : "(DRY RUN)"} ───\n`);

  const raw = readFileSync(resolve(__dirname, "..", "spirits-import.json"), "utf-8");
  const allSpirits: ImportSpirit[] = JSON.parse(raw);

  const drafts = allSpirits.filter(
    (s) => s.recordStatus === "DRAFT" && s.publicationStatus === "DRAFT",
  );
  console.log(`Found ${drafts.length} Draft spirits in import file (of ${allSpirits.length} total)\n`);

  let created = 0;
  let published = 0;
  let skippedNoPrice = 0;
  let skippedNotFound = 0;
  let skippedAlreadyHasOffer = 0;

  for (const spirit of drafts) {
    const pour = spirit.pours?.[0];
    if (!pour || pour.priceUsd == null) {
      console.log(`  SKIP (no price): ${spirit.displayName}`);
      skippedNoPrice++;
      continue;
    }

    const venue = await prisma.venueSpirit.findUnique({
      where: { id: spirit.venueSpirit_id },
      select: {
        id: true,
        restaurantId: true,
        recordStatus: true,
        publicationStatus: true,
        offers: { select: { id: true, priceUsd: true, pourSizeOz: true } },
        definition: { select: { displayName: true } },
      },
    });

    if (!venue) {
      console.log(`  SKIP (not in DB): ${spirit.displayName} (${spirit.venueSpirit_id})`);
      skippedNotFound++;
      continue;
    }

    const hasOffer = venue.offers.some(
      (o) => o.priceUsd != null && o.pourSizeOz != null,
    );
    if (hasOffer) {
      console.log(`  SKIP (already has priced offer): ${spirit.displayName}`);
      skippedAlreadyHasOffer++;
      continue;
    }

    const pourData = {
      restaurantId: venue.restaurantId,
      venueSpiritId: venue.id,
      pourSizeOz: pour.sizeOz,
      pourLabel: pour.label,
      priceUsd: pour.priceUsd,
      isPrimary: pour.isPrimary,
      availability: pour.availability,
      priceIsTemporary: true,
      priceProvenance:
        "Price from spirits-import.json (Sean-authored catalog). " +
        "Pour size is Echo's standard 1.5 oz.",
      commerceSource: "MANUAL" as const,
    };

    if (commit) {
      await prisma.$transaction(async (tx) => {
        await tx.spiritPour.create({ data: pourData });
        await tx.venueSpirit.update({
          where: { id: venue.id },
          data: { recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" },
        });
      });
      console.log(`  CREATED + PUBLISHED: ${spirit.displayName} — $${pour.priceUsd} / ${pour.sizeOz} oz`);
    } else {
      console.log(`  WOULD CREATE + PUBLISH: ${spirit.displayName} — $${pour.priceUsd} / ${pour.sizeOz} oz`);
    }
    created++;
    published++;
  }

  console.log(`\n─── Summary ───`);
  console.log(`  Pours created:          ${created}`);
  console.log(`  Spirits published:      ${published}`);
  console.log(`  Skipped (no price):     ${skippedNoPrice}`);
  console.log(`  Skipped (not in DB):    ${skippedNotFound}`);
  console.log(`  Skipped (has offer):    ${skippedAlreadyHasOffer}`);
  if (!commit) {
    console.log(`\n  This was a DRY RUN. Pass --commit to apply changes.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
