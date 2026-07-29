// Spirit Vault — importer: the 110 rendered guest records → the #137 split DB.
//
// Three layers, deliberately separated so the risky part (writes) is tiny and
// the tested part (planning) is pure:
//
//   1. planImport()  — PURE. Transforms every guest record into its
//      definition / venueSpirit / offers rows (reusing the merged transform.ts),
//      validates each COMPOSED unit (reusing validate.ts), and detects duplicate
//      canonical keys within the batch. No DB, no clock, no I/O. Unit-tested
//      against the real 110 records.
//   2. A narrow persistence PORT (SpiritImportTxStore) — the only surface that
//      touches rows. The Prisma adapter and the in-memory test fake both satisfy
//      it, so idempotency / rollback / tenant-isolation are provable without a
//      live database.
//   3. executeImport() — orchestrates the writes: dry-run short-circuits with
//      ZERO writes; otherwise a single transaction wraps every upsert so any
//      failure rolls the whole import back. Idempotent by canonical key
//      (definition.slug global; venueSpirit (restaurantId, slug); one primary
//      pour per listing; first price observation seeded once).
//
// The importer NEVER guesses a tenant — restaurantId is passed in and its
// existence is verified by the caller (the CLI) before executeImport runs.

import { Prisma, type PrismaClient } from "@prisma/client";
import { guestRecordToRows } from "./transform";
import type {
  GuestRecord,
  SpiritDefinitionRow,
  VenueSpiritRow,
  SpiritPourRow,
} from "./transform";
import {
  validatePublishableSpirit,
  type SpiritValidationError,
  FLAVOR_AXES,
} from "./validate";

// ─────────────────────────────── Plan types ───────────────────────────────

/** One record's fully-composed, validated write unit. */
export interface ComposedSpirit {
  slug: string;
  definition: SpiritDefinitionRow;
  venueSpirit: VenueSpiritRow;
  /** Exactly one primary offer per record (transform guarantees this). */
  offers: SpiritPourRow[];
}

/** A record that failed the publish/validation gate — never written. */
export interface ValidationFailure {
  slug: string;
  errors: SpiritValidationError[];
}

/** A canonical-key collision inside the batch (dropped from the writable set). */
export interface DuplicateKey {
  kind: "definitionSlug" | "venueSpiritSlug" | "toastItemGuid";
  key: string;
  slugs: string[];
}

export interface ImportPlan {
  /** Records safe to write, de-duplicated by canonical key. */
  writable: ComposedSpirit[];
  validationFailures: ValidationFailure[];
  duplicateKeys: DuplicateKey[];
  totals: {
    records: number;
    published: number;
    writable: number;
  };
}

// ─────────────────────────── Pure planning stage ───────────────────────────

/**
 * Compose + validate every guest record. Pure: no DB, no clock, no env.
 * `restaurantId` is not needed here (it only decorates writes), so planning can
 * be asserted against the real 110 records with no tenant.
 */
export function planImport(records: GuestRecord[]): ImportPlan {
  const composed: ComposedSpirit[] = records.map((r) => {
    const rows = guestRecordToRows(r);
    return {
      slug: rows.definition.slug,
      definition: rows.definition,
      venueSpirit: rows.venueSpirit,
      offers: rows.offers,
    };
  });

  const published = composed.filter(
    (c) => c.venueSpirit.publicationStatus === "PUBLISHED",
  ).length;

  // ── Validate each composed unit through the shared publish gate ──
  const validationFailures: ValidationFailure[] = [];
  const validated: ComposedSpirit[] = [];
  for (const c of composed) {
    const errors = validatePublishableSpirit({
      definition: {
        slug: c.definition.slug,
        brand: c.definition.brand,
        category: c.definition.category,
        body: c.definition.body,
        finish: c.definition.finish,
        topNotes: c.definition.topNotes,
        whyShort: c.definition.whyShort,
        flavor: coerceFlavor(c.definition.flavor),
      },
      venueSpirit: {
        slug: c.venueSpirit.slug,
        recordStatus: c.venueSpirit.recordStatus,
        publicationStatus: c.venueSpirit.publicationStatus,
      },
      offers: c.offers.map((o) => ({
        pourSizeOz: o.pourSizeOz,
        priceUsd: o.priceUsd,
        isPrimary: o.isPrimary,
      })),
    });
    if (errors.length) validationFailures.push({ slug: c.slug, errors });
    else validated.push(c);
  }

  // ── Detect duplicate canonical keys within the (validated) batch ──
  // These would trip the DB's unique constraints mid-transaction, so drop the
  // later occurrence and report it rather than let the whole import roll back.
  const { writable, duplicateKeys } = dedupeByCanonicalKeys(validated);

  return {
    writable,
    validationFailures,
    duplicateKeys,
    totals: { records: records.length, published, writable: writable.length },
  };
}

/** validate.ts wants a `{ [axis]: number }` map; transform stores it as JSON. */
function coerceFlavor(flavor: unknown): Record<string, unknown> | null {
  if (flavor && typeof flavor === "object") return flavor as Record<string, unknown>;
  return null;
}

function dedupeByCanonicalKeys(units: ComposedSpirit[]): {
  writable: ComposedSpirit[];
  duplicateKeys: DuplicateKey[];
} {
  const duplicateKeys: DuplicateKey[] = [];
  const seenDefSlug = new Map<string, string>(); // slug → first owning slug
  const seenVenueSlug = new Map<string, string>();
  const seenGuid = new Map<string, string>();
  const writable: ComposedSpirit[] = [];

  for (const u of units) {
    let dup = false;

    const defSlug = u.definition.slug;
    if (seenDefSlug.has(defSlug)) {
      duplicateKeys.push({ kind: "definitionSlug", key: defSlug, slugs: [seenDefSlug.get(defSlug)!, u.slug] });
      dup = true;
    }

    const venueSlug = u.venueSpirit.slug;
    if (seenVenueSlug.has(venueSlug)) {
      duplicateKeys.push({ kind: "venueSpiritSlug", key: venueSlug, slugs: [seenVenueSlug.get(venueSlug)!, u.slug] });
      dup = true;
    }

    // toastItemGuid is unique per tenant (NULLs are distinct → ignore nulls).
    const guids = u.offers.map((o) => o.toastItemGuid).filter((g): g is string => !!g);
    for (const g of guids) {
      if (seenGuid.has(g)) {
        duplicateKeys.push({ kind: "toastItemGuid", key: g, slugs: [seenGuid.get(g)!, u.slug] });
        dup = true;
      }
    }

    if (dup) continue;

    seenDefSlug.set(defSlug, u.slug);
    seenVenueSlug.set(venueSlug, u.slug);
    for (const g of guids) seenGuid.set(g, u.slug);
    writable.push(u);
  }

  return { writable, duplicateKeys };
}

// ───────────────────────────── Persistence port ─────────────────────────────

/** Persisted rows the port hands back (only the fields the executor needs). */
export interface StoredDefinition {
  id: string;
  slug: string;
}
export interface StoredVenueSpirit {
  id: string;
  restaurantId: string;
  slug: string;
}
export interface StoredPour {
  id: string;
  restaurantId: string;
  venueSpiritId: string;
  isPrimary: boolean;
}

/**
 * The transaction-scoped write surface. Every method runs inside the single
 * import transaction. Kept intentionally small: find-then-write (not upsert) so
 * the executor can report insert-vs-update, and so the in-memory fake is trivial.
 */
export interface SpiritImportTxStore {
  findDefinitionBySlug(slug: string): Promise<StoredDefinition | null>;
  createDefinition(row: SpiritDefinitionRow): Promise<StoredDefinition>;
  updateDefinition(id: string, row: SpiritDefinitionRow): Promise<void>;

  findVenueSpirit(restaurantId: string, slug: string): Promise<StoredVenueSpirit | null>;
  createVenueSpirit(
    restaurantId: string,
    spiritDefinitionId: string,
    row: VenueSpiritRow,
  ): Promise<StoredVenueSpirit>;
  updateVenueSpirit(id: string, row: VenueSpiritRow): Promise<void>;

  /** Find the offer this record should upsert: by (restaurantId, toastItemGuid)
   *  when a guid is present, else the listing's existing primary pour. */
  findOffer(
    restaurantId: string,
    venueSpiritId: string,
    toastItemGuid: string | null,
  ): Promise<StoredPour | null>;
  createPour(
    restaurantId: string,
    venueSpiritId: string,
    row: SpiritPourRow,
  ): Promise<StoredPour>;
  updatePour(id: string, restaurantId: string, row: SpiritPourRow): Promise<void>;

  countObservations(offerId: string): Promise<number>;
  createObservation(
    restaurantId: string,
    offerId: string,
    row: SpiritPourRow,
  ): Promise<void>;
}

/** The top-level port: owns the transaction boundary. */
export interface SpiritImportStore {
  runInTransaction<T>(fn: (tx: SpiritImportTxStore) => Promise<T>): Promise<T>;
}

// ─────────────────────────────── Report types ───────────────────────────────

export interface UpsertCounts {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface ImportReport {
  dryRun: boolean;
  restaurantId: string;
  totals: ImportPlan["totals"];
  definitions: UpsertCounts;
  venueListings: UpsertCounts;
  offers: UpsertCounts;
  priceObservations: { inserted: number; skipped: number };
  validationFailures: ValidationFailure[];
  duplicateKeys: DuplicateKey[];
}

// ──────────────────────────── Execution stage ────────────────────────────

export interface ExecuteOptions {
  restaurantId: string;
  /** Default (false) is dry-run: plan + report, ZERO writes. */
  apply?: boolean;
}

/**
 * Apply (or dry-run) a plan for one tenant. On apply, a single transaction wraps
 * every write; any thrown error rolls the whole import back and propagates.
 * Idempotent: rerunning updates in place and never seeds a second initial
 * observation, so counts converge to all-updated / all-skipped.
 */
export async function executeImport(
  store: SpiritImportStore,
  plan: ImportPlan,
  opts: ExecuteOptions,
): Promise<ImportReport> {
  const report: ImportReport = {
    dryRun: opts.apply !== true,
    restaurantId: opts.restaurantId,
    totals: plan.totals,
    // A validation-failed or duplicate record is a skipped def/listing/offer.
    definitions: { inserted: 0, updated: 0, skipped: skippedCount(plan) },
    venueListings: { inserted: 0, updated: 0, skipped: skippedCount(plan) },
    offers: { inserted: 0, updated: 0, skipped: skippedCount(plan) },
    priceObservations: { inserted: 0, skipped: 0 },
    validationFailures: plan.validationFailures,
    duplicateKeys: plan.duplicateKeys,
  };

  // Dry-run: report the intended shape without touching the database.
  if (!opts.apply) return report;

  await store.runInTransaction(async (tx) => {
    for (const unit of plan.writable) {
      // ── SpiritDefinition (shared; keyed by global slug) ──
      const existingDef = await tx.findDefinitionBySlug(unit.definition.slug);
      let definitionId: string;
      if (existingDef) {
        await tx.updateDefinition(existingDef.id, unit.definition);
        report.definitions.updated++;
        definitionId = existingDef.id;
      } else {
        const created = await tx.createDefinition(unit.definition);
        report.definitions.inserted++;
        definitionId = created.id;
      }

      // ── VenueSpirit (tenant listing; keyed by (restaurantId, slug)) ──
      const existingVenue = await tx.findVenueSpirit(opts.restaurantId, unit.venueSpirit.slug);
      let venueSpiritId: string;
      if (existingVenue) {
        await tx.updateVenueSpirit(existingVenue.id, unit.venueSpirit);
        report.venueListings.updated++;
        venueSpiritId = existingVenue.id;
      } else {
        const created = await tx.createVenueSpirit(
          opts.restaurantId,
          definitionId,
          unit.venueSpirit,
        );
        report.venueListings.inserted++;
        venueSpiritId = created.id;
      }

      // ── SpiritPour (the one primary offer) ──
      const primary = unit.offers[0];
      const existingPour = await tx.findOffer(
        opts.restaurantId,
        venueSpiritId,
        primary.toastItemGuid,
      );
      let offerId: string;
      if (existingPour) {
        await tx.updatePour(existingPour.id, opts.restaurantId, primary);
        report.offers.updated++;
        offerId = existingPour.id;
      } else {
        const created = await tx.createPour(opts.restaurantId, venueSpiritId, primary);
        report.offers.inserted++;
        offerId = created.id;
      }

      // ── SpiritPriceObservation (seed the FIRST one only, and only if priced) ──
      if (primary.priceUsd == null) {
        report.priceObservations.skipped++;
      } else {
        const existing = await tx.countObservations(offerId);
        if (existing === 0) {
          await tx.createObservation(opts.restaurantId, offerId, primary);
          report.priceObservations.inserted++;
        } else {
          report.priceObservations.skipped++;
        }
      }
    }
  });

  return report;
}

function skippedCount(plan: ImportPlan): number {
  return plan.validationFailures.length + plan.duplicateKeys.length;
}

// ───────────────────────── Prisma store adapter ─────────────────────────

/** A Prisma client or an interactive-transaction client. */
type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Build the real store backed by Prisma. `runInTransaction` opens one
 * interactive transaction (generous timeout — ~110 records × a few queries) and
 * binds every op to the tx client, so a throw anywhere rolls the batch back.
 */
export function createPrismaSpiritStore(prisma: PrismaClient): SpiritImportStore {
  return {
    async runInTransaction(fn) {
      return prisma.$transaction((tx) => fn(prismaTxStore(tx)), {
        timeout: 120_000,
        maxWait: 20_000,
      });
    },
  };
}

function prismaTxStore(db: PrismaLike): SpiritImportTxStore {
  return {
    async findDefinitionBySlug(slug) {
      return db.spiritDefinition.findUnique({ where: { slug }, select: { id: true, slug: true } });
    },
    async createDefinition(row) {
      const created = await db.spiritDefinition.create({
        data: definitionData(row),
        select: { id: true, slug: true },
      });
      return created;
    },
    async updateDefinition(id, row) {
      await db.spiritDefinition.update({ where: { id }, data: definitionData(row) });
    },

    async findVenueSpirit(restaurantId, slug) {
      return db.venueSpirit.findUnique({
        where: { restaurantId_slug: { restaurantId, slug } },
        select: { id: true, restaurantId: true, slug: true },
      });
    },
    async createVenueSpirit(restaurantId, spiritDefinitionId, row) {
      return db.venueSpirit.create({
        data: { restaurantId, spiritDefinitionId, ...venueSpiritData(row) },
        select: { id: true, restaurantId: true, slug: true },
      });
    },
    async updateVenueSpirit(id, row) {
      await db.venueSpirit.update({ where: { id }, data: venueSpiritData(row) });
    },

    async findOffer(restaurantId, venueSpiritId, toastItemGuid) {
      if (toastItemGuid) {
        const byGuid = await db.spiritPour.findUnique({
          where: { restaurantId_toastItemGuid: { restaurantId, toastItemGuid } },
          select: { id: true, restaurantId: true, venueSpiritId: true, isPrimary: true },
        });
        if (byGuid) return byGuid;
      }
      return db.spiritPour.findFirst({
        where: { restaurantId, venueSpiritId, isPrimary: true },
        select: { id: true, restaurantId: true, venueSpiritId: true, isPrimary: true },
      });
    },
    async createPour(restaurantId, venueSpiritId, row) {
      return db.spiritPour.create({
        data: { restaurantId, venueSpiritId, ...pourData(row) },
        select: { id: true, restaurantId: true, venueSpiritId: true, isPrimary: true },
      });
    },
    async updatePour(id, _restaurantId, row) {
      await db.spiritPour.update({ where: { id }, data: pourData(row) });
    },

    async countObservations(offerId) {
      return db.spiritPriceObservation.count({ where: { offerId } });
    },
    async createObservation(restaurantId, offerId, row) {
      await db.spiritPriceObservation.create({
        data: {
          restaurantId,
          offerId,
          priceUsd: row.priceUsd as number,
          pourSizeOz: row.pourSizeOz,
          source: row.commerceSource,
          provenance: row.priceProvenance,
          effectiveAt: parseDateTime(row.syncedAt),
        },
      });
    },
  };
}

// ── Row → Prisma data mappers (the only place Prisma-specific coercion lives) ──

/** Nullable Json column: JS null must become Prisma.DbNull (SQL NULL). */
function json(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

/** ISO "YYYY-MM-DD" (@db.Date) → Date, or null. */
function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateTime(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function definitionData(row: SpiritDefinitionRow): Prisma.SpiritDefinitionUncheckedCreateInput {
  return {
    slug: row.slug,
    schemaVersion: row.schemaVersion,
    verificationStatus: row.verificationStatus,
    brand: row.brand,
    expression: row.expression,
    displayName: row.displayName,
    subcategory: row.subcategory,
    category: row.category,
    silo: row.silo,
    country: row.country,
    region: row.region,
    city: row.city,
    distilleryName: row.distilleryName,
    producerName: row.producerName,
    style: row.style,
    proofN: row.proofN,
    proofDisplay: row.proofDisplay,
    ageText: row.ageText,
    minYears: row.minYears,
    maxYears: row.maxYears,
    ageSourceUrl: row.ageSourceUrl,
    agePending: row.agePending,
    unaged: row.unaged,
    // NOT NULL columns (DB default 5): coerce a null through to the default.
    body: row.body ?? 5,
    finish: row.finish ?? 5,
    flavor: json(row.flavor),
    topNotes: row.topNotes,
    whyShort: row.whyShort,
    why: row.why,
    production: json(row.production),
    productionStructured: json(row.productionStructured),
    prodTags: row.prodTags,
    pairings: json(row.pairings),
    timeline: json(row.timeline),
    statTiles: json(row.statTiles),
    facts: json(row.facts),
    history: row.history,
    coordinatesText: row.coordinatesText,
    press: json(row.press),
    paths: json(row.paths),
    sources: json(row.sources),
    sourcingLimitations: row.sourcingLimitations,
    knowledgeReviewedAt: parseDate(row.knowledgeReviewedAt),
    knowledgeReviewedBy: row.knowledgeReviewedBy,
  };
}

function venueSpiritData(row: VenueSpiritRow) {
  return {
    slug: row.slug,
    recordStatus: row.recordStatus,
    publicationStatus: row.publicationStatus,
    whyWeCarry: row.whyWeCarry,
    seanShort: row.seanShort,
    notes: row.notes,
    overrides: json(row.overrides),
    reviewedAt: parseDate(row.reviewedAt),
    reviewedBy: row.reviewedBy,
  };
}

function pourData(row: SpiritPourRow) {
  return {
    toastItemGuid: row.toastItemGuid,
    pourSizeOz: row.pourSizeOz,
    pourLabel: row.pourLabel,
    priceUsd: row.priceUsd,
    availability: row.availability,
    isPrimary: row.isPrimary,
    priceIsTemporary: row.priceIsTemporary,
    priceProvenance: row.priceProvenance,
    commerceSource: row.commerceSource,
    syncedAt: parseDateTime(row.syncedAt),
  };
}

// Re-export so the CLI has one import site.
export { FLAVOR_AXES };
