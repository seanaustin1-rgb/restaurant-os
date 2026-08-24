/**
 * Import Gemini-populated spirit content back into the database.
 *
 * Reads `spirits-import.json` (Gemini's output), validates every entry against
 * the vault schema, and writes venue overrides + voice fields to VenueSpirit.
 * Definition-level fields (whyShort) are written to SpiritDefinition.
 *
 * DRY-RUN by default — prints what would change. Pass `--commit` to write.
 *
 * Run:
 *   npx dotenv -e .env.local -o -- tsx scripts/import-gemini-spirits.ts
 *   npx dotenv -e .env.local -o -- tsx scripts/import-gemini-spirits.ts --commit
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient();
const commit = process.argv.includes("--commit");

const FLAVOR_AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;

interface GeminiSpirit {
  venueSpirit_id: string;
  definition_slug: string;
  body: number;
  finish: number;
  flavor: Record<string, number>;
  topNotes: string[];
  pairings: string[];
  whyShort: string | null;
  whyWeCarry: string | null;
  seanShort: string | null;
  notes: string | null;
}

function validate(s: GeminiSpirit, idx: number): string[] {
  const errors: string[] = [];
  const tag = `[${idx}] ${s.definition_slug}`;

  if (!s.venueSpirit_id) errors.push(`${tag}: missing venueSpirit_id`);

  if (!Number.isInteger(s.body) || s.body < 0 || s.body > 10)
    errors.push(`${tag}: body must be integer 0-10, got ${s.body}`);
  if (!Number.isInteger(s.finish) || s.finish < 0 || s.finish > 10)
    errors.push(`${tag}: finish must be integer 0-10, got ${s.finish}`);

  for (const axis of FLAVOR_AXES) {
    const v = s.flavor?.[axis];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 10)
      errors.push(`${tag}: flavor.${axis} must be integer 0-10, got ${v}`);
  }

  if (!Array.isArray(s.topNotes) || s.topNotes.length !== 3 || s.topNotes.some((n) => !n?.trim()))
    errors.push(`${tag}: topNotes must be exactly 3 non-empty strings`);

  if (!Array.isArray(s.pairings) || s.pairings.length < 2 || s.pairings.length > 5)
    errors.push(`${tag}: pairings must be 2-5 entries, got ${s.pairings?.length}`);

  return errors;
}

async function main() {
  const filePath = resolve(__dirname, "..", "spirits-import.json");
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));

  // Handle both bare array and { spirits: [...], schema_suggestions: [...] }
  const spirits: GeminiSpirit[] = Array.isArray(raw) ? raw : raw.spirits ?? raw;
  const suggestions = Array.isArray(raw) ? [] : raw.schema_suggestions ?? [];

  console.log(`Loaded ${spirits.length} spirits from ${filePath}`);
  if (suggestions.length) {
    console.log(`\n── Schema suggestions (${suggestions.length}) ──`);
    for (const s of suggestions) {
      console.log(`  • ${s.field_name} (${s.type}) on ${s.where}: ${s.reason}`);
    }
    console.log();
  }

  // Validate all entries first
  const allErrors: string[] = [];
  for (let i = 0; i < spirits.length; i++) {
    allErrors.push(...validate(spirits[i], i));
  }
  if (allErrors.length) {
    console.error(`\n${allErrors.length} validation errors:\n`);
    for (const e of allErrors) console.error(`  ✗ ${e}`);
    console.error("\nFix these in spirits-import.json and re-run.");
    process.exit(1);
  }
  console.log("All entries pass validation.\n");

  let updated = 0;
  let defUpdated = 0;

  for (const s of spirits) {
    const overrides: Record<string, unknown> = {
      body: s.body,
      finish: s.finish,
      flavor: Object.fromEntries(FLAVOR_AXES.map((a) => [a, s.flavor[a]])),
      topNotes: s.topNotes,
      pairings: s.pairings,
    };

    const venueData = {
      whyWeCarry: s.whyWeCarry?.trim() || null,
      seanShort: s.seanShort?.trim() || null,
      notes: s.notes?.trim() || null,
      overrides: overrides as Prisma.InputJsonValue,
    };

    if (commit) {
      // Fetch existing to preserve any manual edits Sean has already made
      const existing = await prisma.venueSpirit.findUnique({
        where: { id: s.venueSpirit_id },
        select: { whyWeCarry: true, seanShort: true, notes: true, overrides: true },
      });

      // Don't overwrite voice fields Sean already wrote
      const finalData = { ...venueData };
      if (existing?.whyWeCarry) finalData.whyWeCarry = existing.whyWeCarry;
      if (existing?.seanShort) finalData.seanShort = existing.seanShort;
      if (existing?.notes) finalData.notes = existing.notes;

      // Merge overrides — keep existing sensory if already customized
      const existingOverrides = (existing?.overrides ?? {}) as Record<string, unknown>;
      if (existingOverrides.body != null || existingOverrides.finish != null) {
        // Existing sensory overrides exist — skip (Sean already scored this one)
        console.log(`  ⤳ ${s.definition_slug}: preserving existing sensory overrides`);
      } else {
        finalData.overrides = overrides as Prisma.InputJsonValue;
      }

      await prisma.venueSpirit.update({
        where: { id: s.venueSpirit_id },
        data: finalData,
      });
      updated++;

      // Write whyShort to SpiritDefinition if not already set
      if (s.whyShort) {
        const def = await prisma.spiritDefinition.findFirst({
          where: { slug: s.definition_slug },
          select: { id: true, whyShort: true },
        });
        if (def && !def.whyShort) {
          await prisma.spiritDefinition.update({
            where: { id: def.id },
            data: { whyShort: s.whyShort.trim() },
          });
          defUpdated++;
        }
      }
    } else {
      const changes: string[] = [];
      if (venueData.whyWeCarry) changes.push("whyWeCarry");
      if (venueData.seanShort) changes.push("seanShort");
      if (venueData.notes) changes.push("notes");
      changes.push(`sensory(body=${s.body} finish=${s.finish})`);
      changes.push(`topNotes=[${s.topNotes.join(", ")}]`);
      changes.push(`pairings=[${s.pairings.join(", ")}]`);
      if (s.whyShort) changes.push("whyShort");
      console.log(`  ${s.definition_slug}: ${changes.join(", ")}`);
      updated++;
    }
  }

  if (commit) {
    console.log(`\nCommitted: ${updated} VenueSpirit rows, ${defUpdated} SpiritDefinition rows updated.`);
  } else {
    console.log(`\nDRY RUN: ${updated} spirits would be updated. Re-run with --commit to write.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
