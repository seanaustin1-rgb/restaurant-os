/**
 * One-time import of the 104 Spirit Vault records from the static
 * `docs/spirit-vault/spirit-vault-data.js` payload into the `BeverageItem` table.
 *
 * DRY-RUN BY DEFAULT — prints what it would import and touches no database.
 * Pass `--apply` to actually upsert (requires DATABASE_URL for the correct DB):
 *
 *   npx tsx scripts/migrate-spirit-vault.ts              # dry-run, no DB
 *   npx dotenv -e .env.local -- tsx scripts/migrate-spirit-vault.ts --apply
 *
 * Fidelity: it runs the records through the SAME engine the guest vault uses
 * (`makeBatchSpirit` + `normalizeSpiritRecords`, sliced verbatim from the
 * prototype), so the imported rows match the rendered records exactly. The full
 * normalized record is stored in `knowledge` so the dynamic vault can reconstruct
 * the payload byte-for-byte, with the editable/queryable fields projected into
 * typed columns.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const HTML = join(ROOT, "docs/spirit-vault/spirit-vault-prototype.html");
const DATA = join(ROOT, "docs/spirit-vault/spirit-vault-data.js");
const APPLY = process.argv.includes("--apply");
// Restaurant this vault belongs to (the module is restaurant-scoped). Optional:
// leave unset for the dry-run; set SPIRIT_VAULT_RESTAURANT_ID when applying.
const RESTAURANT_ID = process.env.SPIRIT_VAULT_RESTAURANT_ID ?? null;

// ── Load the real engine (makeBatchSpirit + normalizeSpiritRecords + constants)
//    by slicing its inline <script> range out of the prototype, so imported rows
//    are identical to what the guest engine renders. ──
function loadEngine(): {
  makeBatchSpirit: (c: any) => any;
  normalizeSpiritRecords: (r: any[]) => any[];
} {
  const lines = readFileSync(HTML, "utf8").split(/\r?\n/);
  // The engine block runs from `const SPIRIT_DATA_VERSION` to the end of
  // `validateSpiritRecords`. Find those anchors instead of hardcoding numbers.
  const start = lines.findIndex((l) => l.includes("const SPIRIT_DATA_VERSION"));
  const endMarker = lines.findIndex(
    (l, i) => i > start && l.trim() === "const REVIEW_MODE = new URLSearchParams(window.location.search).get('review') === '1';",
  );
  if (start < 0 || endMarker < 0) throw new Error("Could not locate engine block in prototype.html");
  const core = lines.slice(start, endMarker).join("\n");
  const sandbox: any = {
    location: { protocol: "https:", hostname: "example.com" }, // non-dev → validate logs, never throws
    console: { error() {}, log() {}, warn() {} },
  };
  const factory = new Function(
    "location",
    "console",
    `${core}\n; return { makeBatchSpirit, normalizeSpiritRecords, validateSpiritRecords };`,
  );
  return factory(sandbox.location, sandbox.console);
}

function loadRecords(engine: ReturnType<typeof loadEngine>): any[] {
  const src = readFileSync(DATA, "utf8");
  const win: any = {};
  new Function("window", src)(win);
  const raw = win.SPIRIT_VAULT_DATA({ makeBatchSpirit: engine.makeBatchSpirit });
  return engine.normalizeSpiritRecords(raw);
}

// ── Field mapping: normalized record → BeverageItem row ──
const PENDING = "Pending Sean review.";
const seanText = (v: unknown) =>
  typeof v === "string" && v.trim() && v.trim() !== PENDING ? v : null;

const STATUS = (s: string) => (s || "draft").toUpperCase() as "DRAFT" | "REVIEWED" | "PUBLISHED";
const VSTATUS = (s: string) =>
  ((s || "partially-sourced").toUpperCase().replace(/-/g, "_")) as
    | "UNVERIFIED"
    | "PARTIALLY_SOURCED"
    | "SOURCE_REVIEWED"
    | "SEAN_REVIEWED";

function toRow(r: any) {
  const c = r.commerce ?? {};
  return {
    id: r.id as string,
    beverageType: "SPIRIT" as const,
    restaurantId: RESTAURANT_ID,
    brand: r.brand ?? r.name ?? r.id,
    expression: r.expression ?? null,
    displayName: r.identity?.displayName ?? null,
    name: r.name,
    cat: r.cat,
    subcategory: r.subcategory ?? null,
    country: r.country ?? null,
    region: r.region ?? null,
    silo: r.silo ?? "bourbon",
    style: r.style ?? null,
    proofN: typeof r.proofN === "number" ? r.proofN : null,
    proofDisplay: r.proofN == null ? (r.proof ?? null) : null,
    ageText: r.age ?? null,
    minYears: r.ageData?.minYears ?? null,
    maxYears: r.ageData?.maxYears ?? null,
    flavor: r.flavor ?? undefined,
    body: typeof r.body === "number" ? r.body : null,
    finish: typeof r.finish === "number" ? r.finish : null,
    topNotes: r.topNotes ?? undefined,
    // Sean's voice — store null (not the placeholder) so the editor shows empty
    whyWeCarry: seanText(r.whyWeCarry),
    seanShort: seanText(r.seanShort),
    notes: seanText(r.notes),
    pairings: r.pairings ?? undefined,
    paths: r.paths ?? undefined,
    // commerce (Toast-owned, isolated)
    pourPriceUsd: typeof c.pourPriceUsd === "number" ? c.pourPriceUsd : null,
    pourSizeOz: typeof c.pourSizeOz === "number" ? c.pourSizeOz : 2,
    toastItemGuid: c.toastItemGuid ?? null,
    priceProvenance: c.priceProvenance ?? null,
    priceIsTemporary: c.priceIsTemporary ?? true,
    availability: c.availability ?? null,
    lastSyncedAt: c.lastSyncedAt ? new Date(c.lastSyncedAt) : null,
    // extensibility + full-fidelity payload for the dynamic vault
    attributes: r.productionStructured ?? undefined,
    knowledge: r as object, // full normalized record; emit overlays typed edits
    // lifecycle
    recordStatus: STATUS(r.recordStatus),
    publicationStatus: STATUS(r.publicationStatus),
    verificationStatus: VSTATUS(r.verificationStatus),
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
  };
}

async function main() {
  const engine = loadEngine();
  const records = loadRecords(engine);
  const rows = records.map(toRow);

  const byStatus: Record<string, number> = {};
  const byCat: Record<string, number> = {};
  for (const row of rows) {
    const key = `${row.recordStatus}/${row.publicationStatus}`;
    byStatus[key] = (byStatus[key] ?? 0) + 1;
    byCat[row.cat] = (byCat[row.cat] ?? 0) + 1;
  }
  const guest = rows.filter((r) => r.recordStatus === "PUBLISHED" && r.publicationStatus === "PUBLISHED").length;

  console.log(`Parsed ${rows.length} records from spirit-vault-data.js`);
  console.log("By lifecycle:", JSON.stringify(byStatus));
  console.log("By category:", JSON.stringify(byCat));
  console.log("Guest-visible (published/published):", guest);
  const dupes = rows.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
  console.log("Duplicate ids:", dupes.length ? dupes : "none");
  const sample = rows.find((r) => r.id === "makers-mark-46") ?? rows[0];
  console.log("\nSample row (typed cols, knowledge omitted):");
  console.log(JSON.stringify({ ...sample, knowledge: "<full record>" }, null, 2));

  if (!APPLY) {
    console.log("\nDRY RUN — no database was touched. Re-run with --apply (and the correct DATABASE_URL) to import.");
    return;
  }

  const { prisma } = await import("../src/lib/prisma");
  let n = 0;
  for (const row of rows) {
    const { id, ...rest } = row;
    await prisma.beverageItem.upsert({ where: { id }, update: rest as any, create: row as any });
    n++;
  }
  console.log(`\nAPPLIED — upserted ${n} BeverageItem rows.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
