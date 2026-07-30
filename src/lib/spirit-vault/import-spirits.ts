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

import { Prisma, type PrismaClient, type SpiritLifecycleStatus } from "@prisma/client";
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

/**
 * A conflict discovered against the LIVE database during execution (not within
 * the batch) that makes a unit — or one of its moves — unsafe to apply. Recorded
 * on the report so dry-run surfaces it; the offending write is skipped, never
 * forced through a constraint or allowed to orphan a published listing.
 */
export interface ImportConflict {
  kind: "venue-identity-conflict" | "orphaned-source-listing";
  /** The importing unit's slug. */
  slug: string;
  message: string;
  // venue-identity-conflict: the two DIFFERENT existing rows that each claim one
  // of this unit's unique identities (slug vs spiritDefinitionId).
  slugMatchId?: string;
  definitionMatchId?: string;
  // orphaned-source-listing: the published listing a GUID re-parent would empty.
  sourceVenueSpiritId?: string;
  sourceSlug?: string;
  toastItemGuid?: string | null;
}

export interface ImportPlan {
  /** Records safe to write, de-duplicated by canonical key. */
  writable: ComposedSpirit[];
  validationFailures: ValidationFailure[];
  /** Diagnostics — one dropped record can emit several (slug + guid). */
  duplicateKeys: DuplicateKey[];
  /** Distinct records dropped for a duplicate key (≤ duplicateKeys.length). */
  duplicateRecords: number;
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
  const { writable, duplicateKeys, duplicateRecords } = dedupeByCanonicalKeys(validated);

  return {
    writable,
    validationFailures,
    duplicateKeys,
    duplicateRecords,
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
  duplicateRecords: number;
} {
  const duplicateKeys: DuplicateKey[] = [];
  const seenDefSlug = new Map<string, string>(); // slug → first owning slug
  const seenVenueSlug = new Map<string, string>();
  const seenGuid = new Map<string, string>();
  const writable: ComposedSpirit[] = [];
  let duplicateRecords = 0; // distinct dropped records (not diagnostic entries)

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

    if (dup) {
      duplicateRecords++; // one dropped record, however many keys it collided on
      continue;
    }

    seenDefSlug.set(defSlug, u.slug);
    seenVenueSlug.set(venueSlug, u.slug);
    for (const g of guids) seenGuid.set(g, u.slug);
    writable.push(u);
  }

  return { writable, duplicateKeys, duplicateRecords };
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
  /** Does the target tenant exist? Guards dry-run "executable" claims and apply. */
  restaurantExists(restaurantId: string): Promise<boolean>;

  findDefinitionBySlug(slug: string): Promise<StoredDefinition | null>;
  createDefinition(row: SpiritDefinitionRow): Promise<StoredDefinition>;
  updateDefinition(id: string, row: SpiritDefinitionRow): Promise<void>;

  findVenueSpirit(restaurantId: string, slug: string): Promise<StoredVenueSpirit | null>;
  /** A tenant listing has TWO unique identities: (restaurantId, slug) and
   *  (restaurantId, spiritDefinitionId). Look up by the definition identity so a
   *  slug change on the same definition reconciles the existing row instead of
   *  tripping @@unique([restaurantId, spiritDefinitionId]) on create. */
  findVenueSpiritByDefinition(
    restaurantId: string,
    spiritDefinitionId: string,
  ): Promise<StoredVenueSpirit | null>;
  createVenueSpirit(
    restaurantId: string,
    spiritDefinitionId: string,
    row: VenueSpiritRow,
  ): Promise<StoredVenueSpirit>;
  /** Also (re)sets spiritDefinitionId, so a listing pointing at the wrong shared
   *  definition is corrected to the resolved one — not left rendering stale. */
  updateVenueSpirit(
    id: string,
    spiritDefinitionId: string,
    row: VenueSpiritRow,
  ): Promise<void>;

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
  /** Also (re)sets venueSpiritId, so a Toast-GUID match currently parented to a
   *  different listing is MOVED to `venueSpiritId` rather than left orphaned. */
  updatePour(
    id: string,
    restaurantId: string,
    venueSpiritId: string,
    row: SpiritPourRow,
  ): Promise<void>;
  /** Demote every OTHER primary pour on a listing so exactly one primary remains
   *  after a create or a cross-listing re-parent. Returns how many were demoted. */
  demoteOtherPrimaries(
    restaurantId: string,
    venueSpiritId: string,
    keepPourId: string,
  ): Promise<number>;

  /** For the orphaned-source-listing guard on a GUID re-parent: the source
   *  listing's slug + publication status + how many offers it currently owns.
   *  Null if the id is unknown. */
  describeSourceListing(
    restaurantId: string,
    venueSpiritId: string,
  ): Promise<{ slug: string; publicationStatus: SpiritLifecycleStatus; offerCount: number } | null>;

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
  /** Did the tenant exist in the DB? A dry-run projection is only "executable"
   *  when true; apply refuses when false. */
  tenantVerified: boolean;
  totals: ImportPlan["totals"];
  definitions: UpsertCounts;
  venueListings: UpsertCounts;
  offers: UpsertCounts;
  priceObservations: { inserted: number; skipped: number };
  validationFailures: ValidationFailure[];
  duplicateKeys: DuplicateKey[];
  /** Conflicts found against the live DB during execution (identity clashes and
   *  rejected GUID re-parents). Reported in dry-run too; the write was skipped. */
  conflicts: ImportConflict[];
}

// ──────────────────────────── Execution stage ────────────────────────────

export interface ExecuteOptions {
  restaurantId: string;
  /** Default (false) is a DRY-RUN projection: reads existing rows to preview
   *  would-insert / would-update, and writes NOTHING. `true` applies. */
  apply?: boolean;
}

/**
 * Apply — or project (dry-run) — a plan for one tenant. Both modes share one
 * traversal so the dry-run preview is exact:
 *   • dry-run READS existing rows (through the same idempotency keys) to report
 *     would-insert vs would-update, and performs ZERO writes;
 *   • apply performs the writes inside one transaction, so any thrown error
 *     rolls the whole import back and propagates.
 *
 * Idempotent: rerunning updates in place, re-parents a moved Toast-GUID pour to
 * the imported listing, and never seeds a second initial observation — so counts
 * converge to all-updated / all-skipped.
 */
export async function executeImport(
  store: SpiritImportStore,
  plan: ImportPlan,
  opts: ExecuteOptions,
): Promise<ImportReport> {
  const apply = opts.apply === true;
  const skipped = skippedCount(plan); // validation-failed + duplicate records
  const report: ImportReport = {
    dryRun: !apply,
    restaurantId: opts.restaurantId,
    tenantVerified: false,
    totals: plan.totals,
    definitions: { inserted: 0, updated: 0, skipped },
    venueListings: { inserted: 0, updated: 0, skipped },
    offers: { inserted: 0, updated: 0, skipped },
    priceObservations: { inserted: 0, skipped: 0 },
    validationFailures: plan.validationFailures,
    duplicateKeys: plan.duplicateKeys,
    conflicts: [],
  };

  // Both paths run inside runInTransaction. On apply it commits; on dry-run only
  // reads happen (the read-only projection), so the transaction is a no-op.
  await store.runInTransaction(async (tx) => {
    // The tenant must exist for either mode to mean anything: apply would abort
    // on the VenueSpirit FK, and a dry-run projecting inserts against a missing
    // tenant is not an executable preview.
    report.tenantVerified = await tx.restaurantExists(opts.restaurantId);
    if (apply && !report.tenantVerified) {
      throw new Error(
        `restaurant ${opts.restaurantId} does not exist in this database — aborting apply`,
      );
    }

    for (const unit of plan.writable) {
      // ── SpiritDefinition (shared; keyed by global slug) ──
      const existingDef = await tx.findDefinitionBySlug(unit.definition.slug);
      let definitionId: string | null;
      if (existingDef) {
        if (apply) await tx.updateDefinition(existingDef.id, unit.definition);
        report.definitions.updated++;
        definitionId = existingDef.id;
      } else {
        report.definitions.inserted++;
        definitionId = apply ? (await tx.createDefinition(unit.definition)).id : null;
      }

      // ── VenueSpirit (tenant listing) — resolve by BOTH unique identities ──
      // A listing is unique per tenant on (restaurantId, slug) AND on
      // (restaurantId, spiritDefinitionId). Match on either so a slug change on
      // the same definition (or vice-versa) reconciles the existing row instead
      // of colliding on create.
      const bySlug = await tx.findVenueSpirit(opts.restaurantId, unit.venueSpirit.slug);
      const byDefinition =
        definitionId != null
          ? await tx.findVenueSpiritByDefinition(opts.restaurantId, definitionId)
          : null;

      // Both identities resolve, but to DIFFERENT rows — unresolvable. Record it
      // and skip this unit rather than force a constraint violation.
      if (bySlug && byDefinition && bySlug.id !== byDefinition.id) {
        report.conflicts.push({
          kind: "venue-identity-conflict",
          slug: unit.slug,
          message:
            `slug "${unit.venueSpirit.slug}" and definition ${definitionId} resolve to ` +
            `different existing listings (${bySlug.id} vs ${byDefinition.id})`,
          slugMatchId: bySlug.id,
          definitionMatchId: byDefinition.id,
        });
        report.venueListings.skipped++;
        report.offers.skipped++;
        report.priceObservations.skipped++;
        continue;
      }

      // Either identity (slug preferred) points at the row to reconcile. On
      // update, updateVenueSpirit writes the incoming slug, so a definition-match
      // with a stale slug is reconciled to the new slug.
      const existingVenue = bySlug ?? byDefinition;
      let venueSpiritId: string | null;
      if (existingVenue) {
        // Pass definitionId so a listing attached to the wrong definition is
        // corrected. In apply mode definitionId is always resolved above.
        if (apply && definitionId) {
          await tx.updateVenueSpirit(existingVenue.id, definitionId, unit.venueSpirit);
        }
        report.venueListings.updated++;
        venueSpiritId = existingVenue.id;
      } else {
        report.venueListings.inserted++;
        // On dry-run there is no created id; definitionId may also be null.
        venueSpiritId =
          apply && definitionId
            ? (await tx.createVenueSpirit(opts.restaurantId, definitionId, unit.venueSpirit)).id
            : null;
      }

      // ── SpiritPour (the one primary offer) ──
      const primary = unit.offers[0];
      // A new listing (venueSpiritId null) has no pours; only a Toast-GUID match
      // can find an existing pour parented elsewhere.
      const existingPour = await tx.findOffer(
        opts.restaurantId,
        venueSpiritId ?? "",
        primary.toastItemGuid,
      );

      // ── Orphaned-source-listing guard (GUID re-parent) ──
      // A GUID-matched offer parented to a DIFFERENT listing would be MOVED here.
      // If that move empties the source listing and the source is PUBLISHED and
      // the plan does not otherwise restore it, reject the move (don't orphan a
      // guest-visible listing with no price). Checked for dry-run and apply.
      if (existingPour && existingPour.venueSpiritId !== venueSpiritId) {
        const source = await tx.describeSourceListing(
          opts.restaurantId,
          existingPour.venueSpiritId,
        );
        const wouldEmptySource = source != null && source.offerCount <= 1;
        const sourcePublished = source?.publicationStatus === "PUBLISHED";
        const restored = planRestoresSourceListing(plan, source?.slug, primary.toastItemGuid);
        if (source && wouldEmptySource && sourcePublished && !restored) {
          report.conflicts.push({
            kind: "orphaned-source-listing",
            slug: unit.slug,
            message:
              `moving Toast offer ${primary.toastItemGuid} to "${unit.venueSpirit.slug}" ` +
              `would leave published source listing "${source.slug}" with no offers`,
            sourceVenueSpiritId: existingPour.venueSpiritId,
            sourceSlug: source.slug,
            toastItemGuid: primary.toastItemGuid,
          });
          report.offers.skipped++;
          report.priceObservations.skipped++;
          continue; // reject the move; the offer stays on its source listing
        }
      }
      let offerId: string | null;
      let offerExisted: boolean;
      if (existingPour) {
        offerExisted = true;
        offerId = existingPour.id;
        report.offers.updated++;
        // Re-parent to THIS listing (moves a GUID match away from another
        // VenueSpirit) — never leave the imported listing without its offer.
        if (apply && venueSpiritId) {
          await tx.updatePour(existingPour.id, opts.restaurantId, venueSpiritId, primary);
        }
      } else {
        offerExisted = false;
        report.offers.inserted++;
        offerId =
          apply && venueSpiritId
            ? (await tx.createPour(opts.restaurantId, venueSpiritId, primary)).id
            : null;
      }

      // Exactly one primary per listing: after creating or re-parenting THIS
      // primary offer, demote any other primary the destination still carries
      // (e.g. a stale primary the moved Toast-GUID pour now displaces). A no-op
      // on the normal path where the listing has only its own single primary.
      if (apply && venueSpiritId && offerId && primary.isPrimary) {
        await tx.demoteOtherPrimaries(opts.restaurantId, venueSpiritId, offerId);
      }

      // ── SpiritPriceObservation (seed the FIRST one only, and only if priced) ──
      if (primary.priceUsd == null) {
        report.priceObservations.skipped++;
      } else if (!offerExisted) {
        // A brand-new offer always seeds its first observation.
        if (apply && offerId) await tx.createObservation(opts.restaurantId, offerId, primary);
        report.priceObservations.inserted++;
      } else {
        const existing = offerId ? await tx.countObservations(offerId) : 0;
        if (existing === 0) {
          if (apply && offerId) await tx.createObservation(opts.restaurantId, offerId, primary);
          report.priceObservations.inserted++;
        } else {
          report.priceObservations.skipped++;
        }
      }
    }
  });

  return report;
}

/**
 * Does the plan restore a source listing that a GUID re-parent would empty?
 * True when some other unit targets that listing's slug with its own primary,
 * priced offer (and it is not the very GUID leaving the source). If so, the move
 * is safe: the source ends the run with its own guest-visible priced offer.
 */
function planRestoresSourceListing(
  plan: ImportPlan,
  sourceSlug: string | undefined,
  movedGuid: string | null,
): boolean {
  if (!sourceSlug) return false;
  return plan.writable.some((u) => {
    if (u.venueSpirit.slug !== sourceSlug) return false;
    const primary = u.offers[0];
    if (!primary || !primary.isPrimary || primary.priceUsd == null) return false;
    // The restoring offer must be the source's own — not the GUID leaving it.
    if (movedGuid && primary.toastItemGuid === movedGuid) return false;
    return true;
  });
}

function skippedCount(plan: ImportPlan): number {
  // A dropped duplicate is ONE skipped record even though it can emit several
  // duplicateKeys diagnostics (definition slug + venue slug + Toast GUID).
  return plan.validationFailures.length + plan.duplicateRecords;
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
    async restaurantExists(restaurantId) {
      const found = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true },
      });
      return found != null;
    },
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
      const data = definitionData(row) as Record<string, unknown>;
      // Preserve human-authored, shared editorial content: never null a curated
      // definition field from the static payload. Objective facts (proof, age,
      // category, flavor, production, …) still update freely.
      if (!nonEmpty(row.whyShort)) delete data.whyShort;
      if (!nonEmpty(row.why)) delete data.why;
      if (!nonEmpty(row.history)) delete data.history;
      if (!nonEmpty(row.knowledgeReviewedBy)) delete data.knowledgeReviewedBy;
      if (row.knowledgeReviewedAt == null) delete data.knowledgeReviewedAt;
      await db.spiritDefinition.update({
        where: { id },
        data: data as Prisma.SpiritDefinitionUncheckedUpdateInput,
      });
    },

    async findVenueSpirit(restaurantId, slug) {
      return db.venueSpirit.findUnique({
        where: { restaurantId_slug: { restaurantId, slug } },
        select: { id: true, restaurantId: true, slug: true },
      });
    },
    async findVenueSpiritByDefinition(restaurantId, spiritDefinitionId) {
      return db.venueSpirit.findUnique({
        where: { restaurantId_spiritDefinitionId: { restaurantId, spiritDefinitionId } },
        select: { id: true, restaurantId: true, slug: true },
      });
    },
    async createVenueSpirit(restaurantId, spiritDefinitionId, row) {
      return db.venueSpirit.create({
        data: { restaurantId, spiritDefinitionId, ...venueSpiritData(row) },
        select: { id: true, restaurantId: true, slug: true },
      });
    },
    async updateVenueSpirit(id, spiritDefinitionId, row) {
      // Include spiritDefinitionId so a listing on the wrong definition is fixed;
      // slug is written too, so a definition-match with a stale slug reconciles.
      const data: Prisma.VenueSpiritUncheckedUpdateInput = {
        spiritDefinitionId,
        slug: row.slug,
        recordStatus: row.recordStatus,
        publicationStatus: row.publicationStatus,
        reviewedAt: parseDate(row.reviewedAt),
        reviewedBy: row.reviewedBy,
      };
      // Preserve curated, venue-authored content: only overwrite when the
      // incoming value is present — never null a curated field from the payload.
      if (nonEmpty(row.whyWeCarry)) data.whyWeCarry = row.whyWeCarry;
      if (nonEmpty(row.seanShort)) data.seanShort = row.seanShort;
      if (nonEmpty(row.notes)) data.notes = row.notes;
      if (row.overrides != null) data.overrides = json(row.overrides);
      await db.venueSpirit.update({ where: { id }, data });
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
    async updatePour(id, _restaurantId, venueSpiritId, row) {
      // Include venueSpiritId so a re-parented Toast-GUID match moves listings.
      await db.spiritPour.update({ where: { id }, data: { venueSpiritId, ...pourData(row) } });
    },
    async demoteOtherPrimaries(restaurantId, venueSpiritId, keepPourId) {
      const { count } = await db.spiritPour.updateMany({
        where: { restaurantId, venueSpiritId, isPrimary: true, id: { not: keepPourId } },
        data: { isPrimary: false },
      });
      return count;
    },

    async describeSourceListing(restaurantId, venueSpiritId) {
      const v = await db.venueSpirit.findFirst({
        where: { id: venueSpiritId, restaurantId },
        select: { slug: true, publicationStatus: true },
      });
      if (!v) return null;
      const offerCount = await db.spiritPour.count({ where: { restaurantId, venueSpiritId } });
      return { slug: v.slug, publicationStatus: v.publicationStatus, offerCount };
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

/** A curated string worth keeping — present and not blank. */
function nonEmpty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim() !== "";
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
