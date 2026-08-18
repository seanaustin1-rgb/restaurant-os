/**
 * Export the public Spirit Vault as a static website artifact.
 *
 * Read-only against the database: it queries published VenueSpirit rows and writes
 * local files only when --out is supplied.
 *
 * Preview summary, no files written:
 *   npx dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/export-spirit-vault-artifact.ts --restaurant=<restaurantId> --expected-published=<count>"
 *
 * Write the Stone Grille website mount:
 *   npx dotenv -e .env.local -o -- node scripts/demo-db.cjs "npx tsx scripts/export-spirit-vault-artifact.ts --restaurant=<restaurantId> --expected-published=<count> --out=\"C:\\Users\\Default_50\\OneDrive\\Documents\\Stone Grille Website\\echos-reserve\\vault\""
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  PUBLIC_VAULT_ROUTE,
  buildVaultArtifact,
  publishedVaultListingArgs,
} from "../src/lib/spirit-vault/public-vault-artifact";
import type { VaultListingInput } from "../src/lib/spirit-vault/vault-payload";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  const value = eq >= 0 ? hit.slice(eq + 1) : "";
  return value.trim().replace(/^"(.+)"$/, "$1");
}

function usage(message: string): never {
  throw new Error(
    `${message}\n\n` +
      "Required: --restaurant=<restaurantId>\n" +
      "Optional: --out=<artifactDir> --expected-published=<count> --customer=<id> --route=<route>",
  );
}

function compactDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, ".");
}

async function main() {
  const restaurantId = arg("restaurant") || process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim();
  if (!restaurantId) usage("Missing Spirit Vault restaurant id.");

  const expectedPublishedText = arg("expected-published");
  const expectedPublished = expectedPublishedText ? Number(expectedPublishedText) : null;
  if (expectedPublishedText && !Number.isInteger(expectedPublished)) {
    usage(`Invalid --expected-published value: ${expectedPublishedText}`);
  }

  const outDir = arg("out") || process.env.SPIRIT_VAULT_ARTIFACT_OUT?.trim();
  const generatedAt = new Date();
  const listings = (await prisma.venueSpirit.findMany(
    publishedVaultListingArgs(restaurantId),
  )) as unknown as VaultListingInput[];

  if (expectedPublished != null && listings.length !== expectedPublished) {
    throw new Error(
      `Published count mismatch: expected ${expectedPublished}, got ${listings.length}. Refusing to export.`,
    );
  }

  const artifact = buildVaultArtifact({
    listings,
    generatedAt: generatedAt.toISOString(),
    version: compactDate(generatedAt),
    dataVersion: `spirit-vault-${restaurantId}-${listings.length}`,
    customerId: arg("customer") || "stone-grille",
    route: arg("route") || PUBLIC_VAULT_ROUTE,
  });

  console.log("Spirit Vault static artifact");
  console.log(`restaurant: ${restaurantId}`);
  console.log(`published records: ${listings.length}`);
  console.log(`route: ${artifact.manifest.route}`);
  console.log(`index.html: ${artifact.manifest.files[0].bytes} bytes, ${artifact.manifest.files[0].hash}`);

  if (!outDir) {
    console.log("No --out supplied; no files written.");
    return;
  }

  const target = resolve(outDir);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "index.html"), artifact.indexHtml, "utf8");
  writeFileSync(join(target, "manifest.json"), artifact.manifestJson, "utf8");
  console.log(`wrote: ${join(target, "index.html")}`);
  console.log(`wrote: ${join(target, "manifest.json")}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
