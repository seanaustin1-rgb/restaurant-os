import { describe, it, expect } from "vitest";
import type { SpiritLifecycleStatus } from "@prisma/client";
import { loadGuestRecords } from "./load-guest-records";
import type {
  SpiritDefinitionRow,
  VenueSpiritRow,
  SpiritPourRow,
} from "./transform";
import {
  planImport,
  executeImport,
  createPrismaSpiritStore,
  SPIRIT_IMPORT_TRANSACTION_MAX_WAIT_MS,
  SPIRIT_IMPORT_TRANSACTION_TIMEOUT_MS,
  type SpiritImportStore,
  type SpiritImportTxStore,
  type StoredDefinition,
  type StoredVenueSpirit,
  type StoredPour,
} from "./import-spirits";

// ── The real vault, planned once ──
const RECORDS = loadGuestRecords();
const PLAN = planImport(RECORDS);

describe("createPrismaSpiritStore", () => {
  it("uses a long interactive transaction timeout for remote demo imports", async () => {
    let receivedOptions: unknown;
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>, options: unknown) => {
        receivedOptions = options;
        return fn({});
      },
    };

    await createPrismaSpiritStore(prisma as never).runInTransaction(async () => undefined);

    expect(receivedOptions).toEqual({
      timeout: SPIRIT_IMPORT_TRANSACTION_TIMEOUT_MS,
      maxWait: SPIRIT_IMPORT_TRANSACTION_MAX_WAIT_MS,
    });
  });
});

// ─────────────────── In-memory store (no DB needed) ───────────────────
//
// Mirrors the Prisma adapter's find/create/update semantics and the composite
// tenant scoping, so idempotency / isolation / rollback are provable in-process.

interface FakeDefinition extends StoredDefinition {
  row: SpiritDefinitionRow;
}
interface FakeVenue extends StoredVenueSpirit {
  spiritDefinitionId: string;
  row: VenueSpiritRow;
}
interface FakePour extends StoredPour {
  toastItemGuid: string | null;
  row: SpiritPourRow;
}
interface FakeObservation {
  restaurantId: string;
  offerId: string;
}

interface FakeDb {
  definitions: FakeDefinition[];
  venues: FakeVenue[];
  pours: FakePour[];
  observations: FakeObservation[];
}

function emptyDb(): FakeDb {
  return { definitions: [], venues: [], pours: [], observations: [] };
}

function cloneDb(db: FakeDb): FakeDb {
  return {
    definitions: db.definitions.map((d) => ({ ...d })),
    venues: db.venues.map((v) => ({ ...v })),
    pours: db.pours.map((p) => ({ ...p })),
    observations: db.observations.map((o) => ({ ...o })),
  };
}

interface FakeOptions {
  /** Throw once this many definitions have been created (to test rollback). */
  failAfterDefinitions?: number;
  /** Restaurant ids that exist. Omitted → every tenant is treated as existing. */
  existingRestaurants?: string[];
}

function createInMemoryStore(db: FakeDb, opts: FakeOptions = {}) {
  let seq = 0;
  const id = (p: string) => `${p}_${++seq}`;

  function txStore(state: FakeDb): SpiritImportTxStore {
    let createdDefs = 0;
    return {
      async restaurantExists(restaurantId) {
        return opts.existingRestaurants
          ? opts.existingRestaurants.includes(restaurantId)
          : true;
      },
      async findDefinitionBySlug(slug) {
        return state.definitions.find((d) => d.slug === slug) ?? null;
      },
      async createDefinition(row) {
        if (opts.failAfterDefinitions != null && createdDefs >= opts.failAfterDefinitions) {
          throw new Error("injected failure (createDefinition)");
        }
        createdDefs++;
        const rec: FakeDefinition = { id: id("def"), slug: row.slug, row };
        state.definitions.push(rec);
        return { id: rec.id, slug: rec.slug };
      },
      async updateDefinition(defId, row) {
        const d = state.definitions.find((x) => x.id === defId);
        if (!d) throw new Error("updateDefinition: not found");
        d.row = mergeDefinitionCurated(d.row, row); // never null curated editorial
      },

      async findVenueSpirit(restaurantId, slug) {
        return (
          state.venues.find((v) => v.restaurantId === restaurantId && v.slug === slug) ?? null
        );
      },
      async findVenueSpiritByDefinition(restaurantId, spiritDefinitionId) {
        const v = state.venues.find(
          (x) => x.restaurantId === restaurantId && x.spiritDefinitionId === spiritDefinitionId,
        );
        return v ? { id: v.id, restaurantId: v.restaurantId, slug: v.slug } : null;
      },
      async createVenueSpirit(restaurantId, spiritDefinitionId, row) {
        const rec: FakeVenue = {
          id: id("venue"),
          restaurantId,
          slug: row.slug,
          spiritDefinitionId,
          row,
        };
        state.venues.push(rec);
        return { id: rec.id, restaurantId, slug: rec.slug };
      },
      async updateVenueSpirit(venueId, spiritDefinitionId, row) {
        const v = state.venues.find((x) => x.id === venueId);
        if (!v) throw new Error("updateVenueSpirit: not found");
        v.row = mergeVenueCurated(v.row, row); // preserve curated venue-authored content
        v.slug = row.slug; // reconcile slug to the incoming slug (definition-match)
        v.spiritDefinitionId = spiritDefinitionId; // correct the definition FK
      },

      async findOffer(restaurantId, venueSpiritId, toastItemGuid) {
        if (toastItemGuid) {
          const byGuid = state.pours.find(
            (p) => p.restaurantId === restaurantId && p.toastItemGuid === toastItemGuid,
          );
          if (byGuid) return byGuid;
        }
        return (
          state.pours.find(
            (p) =>
              p.restaurantId === restaurantId &&
              p.venueSpiritId === venueSpiritId &&
              p.isPrimary,
          ) ?? null
        );
      },
      async createPour(restaurantId, venueSpiritId, row) {
        const rec: FakePour = {
          id: id("pour"),
          restaurantId,
          venueSpiritId,
          isPrimary: row.isPrimary,
          toastItemGuid: row.toastItemGuid,
          row,
        };
        state.pours.push(rec);
        return { id: rec.id, restaurantId, venueSpiritId, isPrimary: rec.isPrimary };
      },
      async updatePour(pourId, _restaurantId, venueSpiritId, row) {
        const p = state.pours.find((x) => x.id === pourId);
        if (!p) throw new Error("updatePour: not found");
        p.row = row;
        p.toastItemGuid = row.toastItemGuid;
        p.venueSpiritId = venueSpiritId; // re-parent a moved Toast-GUID match
      },
      async demoteOtherPrimaries(restaurantId, venueSpiritId, keepPourId) {
        let count = 0;
        for (const p of state.pours) {
          if (
            p.restaurantId === restaurantId &&
            p.venueSpiritId === venueSpiritId &&
            p.isPrimary &&
            p.id !== keepPourId
          ) {
            p.isPrimary = false;
            count++;
          }
        }
        return count;
      },

      async describeSourceListing(restaurantId, venueSpiritId) {
        const v = state.venues.find(
          (x) => x.restaurantId === restaurantId && x.id === venueSpiritId,
        );
        if (!v) return null;
        const offerCount = state.pours.filter(
          (p) => p.restaurantId === restaurantId && p.venueSpiritId === venueSpiritId,
        ).length;
        // Bare test rows may omit publicationStatus → treat as unpublished (DRAFT).
        const status = (v.row as Partial<VenueSpiritRow>).publicationStatus ?? "DRAFT";
        return { slug: v.slug, publicationStatus: status, offerCount };
      },

      async countObservations(offerId) {
        return state.observations.filter((o) => o.offerId === offerId).length;
      },
      async createObservation(restaurantId, offerId) {
        state.observations.push({ restaurantId, offerId });
      },
    };
  }

  const store: SpiritImportStore = {
    async runInTransaction(fn) {
      const snapshot = cloneDb(db);
      try {
        return await fn(txStore(db));
      } catch (e) {
        // Restore the snapshot in place (rollback).
        db.definitions = snapshot.definitions;
        db.venues = snapshot.venues;
        db.pours = snapshot.pours;
        db.observations = snapshot.observations;
        throw e;
      }
    },
  };

  return store;
}

// Mirror the Prisma adapter's curated-preservation semantics: on UPDATE, an
// incoming null/blank never overwrites an existing curated value.
function keep(incoming: string | null | undefined, existing: string | null | undefined): string | null {
  return incoming != null && incoming !== "" ? incoming : existing ?? null;
}

function mergeVenueCurated(existing: VenueSpiritRow, incoming: VenueSpiritRow): VenueSpiritRow {
  return {
    ...incoming,
    whyWeCarry: keep(incoming.whyWeCarry, existing?.whyWeCarry),
    seanShort: keep(incoming.seanShort, existing?.seanShort),
    notes: keep(incoming.notes, existing?.notes),
    overrides: incoming.overrides != null ? incoming.overrides : existing?.overrides ?? null,
  };
}

function mergeDefinitionCurated(
  existing: SpiritDefinitionRow,
  incoming: SpiritDefinitionRow,
): SpiritDefinitionRow {
  return {
    ...incoming,
    whyShort: keep(incoming.whyShort, existing?.whyShort),
    why: keep(incoming.why, existing?.why),
    history: keep(incoming.history, existing?.history),
    knowledgeReviewedBy: keep(incoming.knowledgeReviewedBy, existing?.knowledgeReviewedBy),
    knowledgeReviewedAt: keep(incoming.knowledgeReviewedAt, existing?.knowledgeReviewedAt),
  };
}

const ECHO = "echo-reserve-restaurant-id";

// ──────────────────────────────── Tests ────────────────────────────────

describe("planImport — real 110 records", () => {
  it("plans 110 records, 109 published, all writable", () => {
    expect(PLAN.totals.records).toBe(110);
    expect(PLAN.totals.published).toBe(109);
    expect(PLAN.totals.writable).toBe(110);
  });

  it("has no validation failures or duplicate canonical keys", () => {
    expect(PLAN.validationFailures).toEqual([]);
    expect(PLAN.duplicateKeys).toEqual([]);
  });
});

describe("executeImport — dry-run projection", () => {
  it("previews would-insert counts against an empty DB and writes nothing", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db);
    const report = await executeImport(store, PLAN, { restaurantId: ECHO }); // apply omitted

    expect(report.dryRun).toBe(true);
    // Against an empty tenant every record would be inserted — NOT all-zero.
    expect(report.definitions).toEqual({ inserted: 110, updated: 0, skipped: 0 });
    expect(report.venueListings).toEqual({ inserted: 110, updated: 0, skipped: 0 });
    expect(report.offers).toEqual({ inserted: 110, updated: 0, skipped: 0 });
    expect(report.priceObservations).toEqual({ inserted: 110, skipped: 0 });

    // …but nothing was actually written.
    expect(db.definitions).toHaveLength(0);
    expect(db.venues).toHaveLength(0);
    expect(db.pours).toHaveLength(0);
    expect(db.observations).toHaveLength(0);
  });

  it("previews would-update after a prior apply, still writing nothing", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db);
    await executeImport(store, PLAN, { restaurantId: ECHO, apply: true });

    const before = {
      d: db.definitions.length,
      v: db.venues.length,
      p: db.pours.length,
      o: db.observations.length,
    };
    const dry = await executeImport(store, PLAN, { restaurantId: ECHO }); // dry-run

    expect(dry.dryRun).toBe(true);
    expect(dry.definitions).toMatchObject({ inserted: 0, updated: 110 });
    expect(dry.offers).toMatchObject({ inserted: 0, updated: 110 });
    expect(dry.priceObservations).toEqual({ inserted: 0, skipped: 110 });
    // No row counts changed by the projection.
    expect(db.definitions).toHaveLength(before.d);
    expect(db.venues).toHaveLength(before.v);
    expect(db.pours).toHaveLength(before.p);
    expect(db.observations).toHaveLength(before.o);
  });
});

describe("executeImport — apply then idempotent rerun", () => {
  it("first run inserts everything; second run updates in place with no duplicates", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db);

    const first = await executeImport(store, PLAN, { restaurantId: ECHO, apply: true });
    expect(first.dryRun).toBe(false);
    expect(first.definitions.inserted).toBe(110);
    expect(first.venueListings.inserted).toBe(110);
    expect(first.offers.inserted).toBe(110);
    // Every real record has a price, so every offer seeds one observation.
    expect(first.priceObservations.inserted).toBe(110);
    expect(first.priceObservations.skipped).toBe(0);

    expect(db.definitions).toHaveLength(110);
    expect(db.venues).toHaveLength(110);
    expect(db.pours).toHaveLength(110);
    expect(db.observations).toHaveLength(110);

    const second = await executeImport(store, PLAN, { restaurantId: ECHO, apply: true });
    expect(second.definitions).toMatchObject({ inserted: 0, updated: 110 });
    expect(second.venueListings).toMatchObject({ inserted: 0, updated: 110 });
    expect(second.offers).toMatchObject({ inserted: 0, updated: 110 });
    // The first observation is never re-seeded.
    expect(second.priceObservations.inserted).toBe(0);
    expect(second.priceObservations.skipped).toBe(110);

    // No row growth on the rerun.
    expect(db.definitions).toHaveLength(110);
    expect(db.venues).toHaveLength(110);
    expect(db.pours).toHaveLength(110);
    expect(db.observations).toHaveLength(110);
  });
});

describe("executeImport — tenant isolation", () => {
  it("shares definitions but keeps venue listings and pours per-tenant", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db);

    await executeImport(store, PLAN, { restaurantId: "tenant-a", apply: true });
    const secondTenant = await executeImport(store, PLAN, { restaurantId: "tenant-b", apply: true });

    // Shared knowledge: tenant B reuses (updates) A's definitions, adds none.
    expect(secondTenant.definitions).toMatchObject({ inserted: 0, updated: 110 });
    expect(db.definitions).toHaveLength(110);

    // Tenant-scoped: B gets its own 110 listings + pours; A's stay intact.
    expect(secondTenant.venueListings.inserted).toBe(110);
    expect(secondTenant.offers.inserted).toBe(110);
    expect(db.venues.filter((v) => v.restaurantId === "tenant-a")).toHaveLength(110);
    expect(db.venues.filter((v) => v.restaurantId === "tenant-b")).toHaveLength(110);
    expect(db.pours.filter((p) => p.restaurantId === "tenant-a")).toHaveLength(110);
    expect(db.pours.filter((p) => p.restaurantId === "tenant-b")).toHaveLength(110);

    // Every pour belongs to a venue of the same tenant (composite-FK invariant).
    const venueTenant = new Map(db.venues.map((v) => [v.id, v.restaurantId]));
    for (const p of db.pours) {
      expect(venueTenant.get(p.venueSpiritId)).toBe(p.restaurantId);
    }
  });
});

// ── Small hand-built plans for edge cases planImport can't easily produce ──

function composedUnit(
  slug: string,
  guid: string | null,
): { slug: string; definition: SpiritDefinitionRow; venueSpirit: VenueSpiritRow; offers: SpiritPourRow[] } {
  return {
    slug,
    definition: { slug: `${slug}-def`, brand: "X", category: "Bourbon" } as unknown as SpiritDefinitionRow,
    venueSpirit: { slug, recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" } as unknown as VenueSpiritRow,
    offers: [{ toastItemGuid: guid, priceUsd: 10, isPrimary: true } as unknown as SpiritPourRow],
  };
}

function singleUnitPlan(slug: string, guid: string | null) {
  return {
    writable: [composedUnit(slug, guid)],
    validationFailures: [],
    duplicateKeys: [],
    duplicateRecords: 0,
    totals: { records: 1, published: 1, writable: 1 },
  };
}

describe("executeImport — re-parents a moved Toast-GUID pour", () => {
  it("moves a GUID-matched pour to the imported listing instead of orphaning it", async () => {
    const db = emptyDb();
    // Pre-existing state: definition D, listing A, and a pour with guid G under A.
    db.definitions.push({ id: "def-1", slug: "listing-a-def", row: {} as SpiritDefinitionRow });
    db.venues.push({
      id: "venue-A",
      restaurantId: ECHO,
      slug: "listing-a",
      spiritDefinitionId: "def-1",
      row: {} as VenueSpiritRow,
    });
    db.pours.push({
      id: "pour-G",
      restaurantId: ECHO,
      venueSpiritId: "venue-A",
      isPrimary: true,
      toastItemGuid: "GUID-G",
      row: {} as SpiritPourRow,
    });

    const store = createInMemoryStore(db);
    // Import a DIFFERENT listing (listing-b) whose primary offer carries guid G.
    await executeImport(store, singleUnitPlan("listing-b", "GUID-G"), {
      restaurantId: ECHO,
      apply: true,
    });

    const newListing = db.venues.find((v) => v.slug === "listing-b")!;
    expect(newListing).toBeDefined();
    // The single pour was re-parented to the imported listing — not left on A,
    // and no duplicate pour was created.
    const pour = db.pours.find((p) => p.toastItemGuid === "GUID-G")!;
    expect(db.pours).toHaveLength(1);
    expect(pour.venueSpiritId).toBe(newListing.id);
  });
});

describe("executeImport — skipped counts distinct records", () => {
  it("counts one dropped duplicate record once, not per diagnostic", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db);
    // One dropped record that collided on definition slug AND venue slug AND guid.
    const plan = {
      writable: [],
      validationFailures: [],
      duplicateKeys: [
        { kind: "definitionSlug" as const, key: "d", slugs: ["a", "b"] },
        { kind: "venueSpiritSlug" as const, key: "b", slugs: ["a", "b"] },
        { kind: "toastItemGuid" as const, key: "g", slugs: ["a", "b"] },
      ],
      duplicateRecords: 1,
      totals: { records: 2, published: 2, writable: 1 },
    };
    const report = await executeImport(store, plan, { restaurantId: ECHO, apply: true });
    // Three diagnostics, but exactly ONE skipped record.
    expect(report.definitions.skipped).toBe(1);
    expect(report.venueListings.skipped).toBe(1);
    expect(report.offers.skipped).toBe(1);
    expect(report.duplicateKeys).toHaveLength(3);
  });
});

describe("executeImport — reconciles the destination primary on re-parent", () => {
  it("demotes the destination's existing primary so exactly one remains", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-1", slug: "recon-def", row: {} as SpiritDefinitionRow });
    // Destination listing D already carries its own primary P1 (no Toast GUID).
    db.venues.push({
      id: "venue-D",
      restaurantId: ECHO,
      slug: "recon",
      spiritDefinitionId: "def-1",
      row: {} as VenueSpiritRow,
    });
    db.pours.push({
      id: "pour-P1",
      restaurantId: ECHO,
      venueSpiritId: "venue-D",
      isPrimary: true,
      toastItemGuid: null,
      row: {} as SpiritPourRow,
    });
    // A GUID pour P2 lives under a DIFFERENT listing A.
    db.venues.push({
      id: "venue-A",
      restaurantId: ECHO,
      slug: "other",
      spiritDefinitionId: "def-1",
      row: {} as VenueSpiritRow,
    });
    db.pours.push({
      id: "pour-P2",
      restaurantId: ECHO,
      venueSpiritId: "venue-A",
      isPrimary: true,
      toastItemGuid: "GUID-G",
      row: {} as SpiritPourRow,
    });

    const store = createInMemoryStore(db);
    // Importing listing "recon" with guid G re-parents P2 into D.
    await executeImport(store, singleUnitPlan("recon", "GUID-G"), {
      restaurantId: ECHO,
      apply: true,
    });

    const primariesUnderD = db.pours.filter((p) => p.venueSpiritId === "venue-D" && p.isPrimary);
    expect(primariesUnderD).toHaveLength(1); // exactly one primary
    expect(primariesUnderD[0].id).toBe("pour-P2"); // the imported GUID offer wins
    const p1 = db.pours.find((p) => p.id === "pour-P1")!;
    expect(p1.isPrimary).toBe(false); // the stale primary was demoted, not deleted
    expect(p1.venueSpiritId).toBe("venue-D");
  });
});

describe("executeImport — corrects the listing's definition FK", () => {
  it("repoints an existing listing to the resolved definition", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-old", slug: "old-slug", row: {} as SpiritDefinitionRow });
    db.definitions.push({ id: "def-new", slug: "fk-def", row: {} as SpiritDefinitionRow });
    // Listing exists but points at the WRONG (old) definition.
    db.venues.push({
      id: "venue-V",
      restaurantId: ECHO,
      slug: "fk",
      spiritDefinitionId: "def-old",
      row: {} as VenueSpiritRow,
    });

    const store = createInMemoryStore(db);
    // Unit slug "fk" → definition.slug "fk-def" (def-new).
    await executeImport(store, singleUnitPlan("fk", "GUID-FK"), {
      restaurantId: ECHO,
      apply: true,
    });

    expect(db.venues.find((v) => v.id === "venue-V")!.spiritDefinitionId).toBe("def-new");
  });
});

describe("executeImport — tenant existence", () => {
  it("dry-run flags a missing tenant as not executable but still projects", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db, { existingRestaurants: [] }); // ECHO absent
    const report = await executeImport(store, singleUnitPlan("x", "g"), { restaurantId: ECHO });

    expect(report.dryRun).toBe(true);
    expect(report.tenantVerified).toBe(false);
    expect(report.definitions.inserted).toBe(1); // projection still computed
    expect(db.definitions).toHaveLength(0); // nothing written
  });

  it("dry-run marks an existing tenant verified", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db, { existingRestaurants: [ECHO] });
    const report = await executeImport(store, singleUnitPlan("x", "g"), { restaurantId: ECHO });
    expect(report.tenantVerified).toBe(true);
  });

  it("apply aborts (and writes nothing) when the tenant does not exist", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db, { existingRestaurants: [] });
    await expect(
      executeImport(store, singleUnitPlan("x", "g"), { restaurantId: ECHO, apply: true }),
    ).rejects.toThrow(/does not exist/);
    expect(db.definitions).toHaveLength(0);
  });
});

// ── Helpers for the dual-identity / orphan-guard / curated-preservation cases ──

function venueRow(slug: string, extra: Partial<VenueSpiritRow> = {}): VenueSpiritRow {
  return {
    slug,
    recordStatus: "PUBLISHED",
    publicationStatus: "PUBLISHED",
    whyWeCarry: null,
    seanShort: null,
    notes: null,
    overrides: null,
    reviewedAt: null,
    reviewedBy: null,
    ...extra,
  };
}

function unitWith(opts: {
  venueSlug: string;
  defSlug: string;
  guid?: string | null;
  whyWeCarry?: string | null;
  publicationStatus?: SpiritLifecycleStatus;
  priceUsd?: number | null;
}) {
  return {
    slug: opts.venueSlug,
    definition: {
      slug: opts.defSlug,
      brand: "X",
      category: "Bourbon",
    } as unknown as SpiritDefinitionRow,
    venueSpirit: venueRow(opts.venueSlug, {
      publicationStatus: opts.publicationStatus ?? "PUBLISHED",
      whyWeCarry: opts.whyWeCarry ?? null,
    }) as VenueSpiritRow,
    offers: [
      {
        toastItemGuid: opts.guid ?? null,
        priceUsd: opts.priceUsd === undefined ? 10 : opts.priceUsd,
        isPrimary: true,
      } as unknown as SpiritPourRow,
    ],
  };
}

function planOf(...units: ReturnType<typeof unitWith>[]) {
  return {
    writable: units,
    validationFailures: [],
    duplicateKeys: [],
    duplicateRecords: 0,
    totals: { records: units.length, published: units.length, writable: units.length },
  };
}

describe("executeImport — VenueSpirit dual-identity reconciliation", () => {
  it("reconciles a listing matched by spiritDefinitionId under a NEW slug (no second row, no uniqueness violation)", async () => {
    const db = emptyDb();
    // Shared definition already imported; the tenant's listing carries the OLD slug.
    db.definitions.push({ id: "def-1", slug: "shared-def", row: {} as SpiritDefinitionRow });
    db.venues.push({
      id: "venue-X",
      restaurantId: ECHO,
      slug: "old-slug",
      spiritDefinitionId: "def-1",
      row: venueRow("old-slug"),
    });

    const store = createInMemoryStore(db);
    // Re-import the SAME definition (slug "shared-def") but under a NEW venue slug.
    const report = await executeImport(
      store,
      planOf(unitWith({ venueSlug: "new-slug", defSlug: "shared-def" })),
      { restaurantId: ECHO, apply: true },
    );

    // Exactly one listing — reconciled in place, not duplicated.
    expect(db.venues).toHaveLength(1);
    const v = db.venues[0];
    expect(v.id).toBe("venue-X"); // same row
    expect(v.slug).toBe("new-slug"); // slug reconciled to the incoming one
    expect(v.spiritDefinitionId).toBe("def-1");
    expect(report.venueListings).toMatchObject({ inserted: 0, updated: 1 });
    expect(report.conflicts).toEqual([]);
  });

  it("dry-run reports the definition-match/new-slug case as update, not insert, writing nothing", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-1", slug: "shared-def", row: {} as SpiritDefinitionRow });
    db.venues.push({
      id: "venue-X",
      restaurantId: ECHO,
      slug: "old-slug",
      spiritDefinitionId: "def-1",
      row: venueRow("old-slug"),
    });

    const store = createInMemoryStore(db);
    const report = await executeImport(
      store,
      planOf(unitWith({ venueSlug: "new-slug", defSlug: "shared-def" })),
      { restaurantId: ECHO }, // dry-run
    );

    expect(report.dryRun).toBe(true);
    expect(report.venueListings).toMatchObject({ inserted: 0, updated: 1 });
    // Nothing written: still one row, still the OLD slug.
    expect(db.venues).toHaveLength(1);
    expect(db.venues[0].slug).toBe("old-slug");
  });

  it("records a conflict and skips when slug and definition resolve to DIFFERENT rows", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-1", slug: "shared-def", row: {} as SpiritDefinitionRow });
    // Row A owns the incoming slug; row B owns the incoming definition. Distinct.
    db.venues.push({
      id: "venue-slug",
      restaurantId: ECHO,
      slug: "target-slug",
      spiritDefinitionId: "def-other",
      row: venueRow("target-slug"),
    });
    db.venues.push({
      id: "venue-def",
      restaurantId: ECHO,
      slug: "some-other-slug",
      spiritDefinitionId: "def-1",
      row: venueRow("some-other-slug"),
    });

    const store = createInMemoryStore(db);
    const report = await executeImport(
      store,
      planOf(unitWith({ venueSlug: "target-slug", defSlug: "shared-def" })),
      { restaurantId: ECHO, apply: true },
    );

    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toMatchObject({
      kind: "venue-identity-conflict",
      slugMatchId: "venue-slug",
      definitionMatchId: "venue-def",
    });
    // Neither existing row mutated, no new row, and the venue write is skipped.
    expect(db.venues).toHaveLength(2);
    expect(report.venueListings.skipped).toBeGreaterThanOrEqual(1);
  });
});

describe("executeImport — orphaned-source-listing guard on GUID re-parent", () => {
  it("rejects a move that would leave a PUBLISHED source listing with zero offers", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-A", slug: "def-a", row: {} as SpiritDefinitionRow });
    // Source listing A is PUBLISHED and its ONLY offer carries GUID-G.
    db.venues.push({
      id: "venue-A",
      restaurantId: ECHO,
      slug: "listing-a",
      spiritDefinitionId: "def-A",
      row: venueRow("listing-a", { publicationStatus: "PUBLISHED" }),
    });
    db.pours.push({
      id: "pour-G",
      restaurantId: ECHO,
      venueSpiritId: "venue-A",
      isPrimary: true,
      toastItemGuid: "GUID-G",
      row: {} as SpiritPourRow,
    });

    const store = createInMemoryStore(db);
    // Import a DIFFERENT listing claiming GUID-G, with nothing restoring A.
    const report = await executeImport(
      store,
      planOf(unitWith({ venueSlug: "listing-b", defSlug: "listing-b-def", guid: "GUID-G" })),
      { restaurantId: ECHO, apply: true },
    );

    // The move was rejected and surfaced as a conflict.
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toMatchObject({
      kind: "orphaned-source-listing",
      sourceSlug: "listing-a",
      toastItemGuid: "GUID-G",
    });
    expect(report.offers).toMatchObject({ inserted: 0, skipped: 1 });

    // The pour stayed on A; A is NOT left published-with-zero-offers.
    const pourG = db.pours.find((p) => p.toastItemGuid === "GUID-G")!;
    expect(pourG.venueSpiritId).toBe("venue-A");
    expect(db.pours).toHaveLength(1); // no duplicate pour created
    const offersOnA = db.pours.filter((p) => p.venueSpiritId === "venue-A");
    expect(offersOnA.length).toBeGreaterThanOrEqual(1);
  });

  it("leaves no new destination listing and no published zero-offer listing when a move is rejected", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-A", slug: "def-a", row: {} as SpiritDefinitionRow });
    // Source listing A is PUBLISHED and its ONLY offer carries GUID-G.
    db.venues.push({
      id: "venue-A",
      restaurantId: ECHO,
      slug: "listing-a",
      spiritDefinitionId: "def-A",
      row: venueRow("listing-a", { publicationStatus: "PUBLISHED" }),
    });
    db.pours.push({
      id: "pour-G",
      restaurantId: ECHO,
      venueSpiritId: "venue-A",
      isPrimary: true,
      toastItemGuid: "GUID-G",
      row: {} as SpiritPourRow,
    });
    const venuesBefore = db.venues.length;

    const store = createInMemoryStore(db);
    // Import a BRAND-NEW listing-b claiming GUID-G, with nothing restoring A. The
    // imported unit is PUBLISHED — so if the guard ran after the listing write it
    // would strand a published, zero-offer destination row.
    const report = await executeImport(
      store,
      planOf(unitWith({ venueSlug: "listing-b", defSlug: "listing-b-def", guid: "GUID-G" })),
      { restaurantId: ECHO, apply: true },
    );

    // The move was rejected and the WHOLE unit skipped (no listing write).
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toMatchObject({ kind: "orphaned-source-listing" });
    expect(report.venueListings).toMatchObject({ inserted: 0, skipped: 1 });

    // No new destination listing was created — the rejected move wrote nothing.
    expect(db.venues.find((v) => v.slug === "listing-b")).toBeUndefined();
    expect(db.venues).toHaveLength(venuesBefore);

    // No PUBLISHED listing is left with zero offers (source A kept its pour; no
    // empty destination was stranded).
    const publishedWithNoOffers = db.venues.filter(
      (v) =>
        (v.row as Partial<VenueSpiritRow>).publicationStatus === "PUBLISHED" &&
        db.pours.filter((p) => p.venueSpiritId === v.id).length === 0,
    );
    expect(publishedWithNoOffers).toEqual([]);
  });

  it("allows the move when the plan restores the source listing with its own priced offer", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-A", slug: "def-a", row: {} as SpiritDefinitionRow });
    db.venues.push({
      id: "venue-A",
      restaurantId: ECHO,
      slug: "listing-a",
      spiritDefinitionId: "def-A",
      row: venueRow("listing-a", { publicationStatus: "PUBLISHED" }),
    });
    db.pours.push({
      id: "pour-G",
      restaurantId: ECHO,
      venueSpiritId: "venue-A",
      isPrimary: true,
      toastItemGuid: "GUID-G",
      row: {} as SpiritPourRow,
    });

    const store = createInMemoryStore(db);
    // Destination claims GUID-G; a SECOND unit restores listing-a with its own
    // priced primary offer (GUID-H), so the move is safe.
    const report = await executeImport(
      store,
      planOf(
        unitWith({ venueSlug: "listing-b", defSlug: "listing-b-def", guid: "GUID-G" }),
        unitWith({ venueSlug: "listing-a", defSlug: "def-a", guid: "GUID-H" }),
      ),
      { restaurantId: ECHO, apply: true },
    );

    expect(report.conflicts).toEqual([]);
    // GUID-G moved to the destination listing…
    const dest = db.venues.find((v) => v.slug === "listing-b")!;
    const pourG = db.pours.find((p) => p.toastItemGuid === "GUID-G")!;
    expect(pourG.venueSpiritId).toBe(dest.id);
    // …and A ends the run with its own offer — not orphaned.
    const offersOnA = db.pours.filter((p) => p.venueSpiritId === "venue-A");
    expect(offersOnA.length).toBeGreaterThanOrEqual(1);
  });
});

describe("executeImport — preserves curated venue fields on update", () => {
  it("keeps an existing whyWeCarry when the re-imported record's whyWeCarry is null", async () => {
    const db = emptyDb();
    db.definitions.push({ id: "def-1", slug: "cur-def", row: {} as SpiritDefinitionRow });
    db.venues.push({
      id: "venue-C",
      restaurantId: ECHO,
      slug: "cur",
      spiritDefinitionId: "def-1",
      row: venueRow("cur", { whyWeCarry: "Because Sean loves it" }),
    });

    const store = createInMemoryStore(db);
    await executeImport(
      store,
      planOf(unitWith({ venueSlug: "cur", defSlug: "cur-def", whyWeCarry: null })),
      { restaurantId: ECHO, apply: true },
    );

    // The curated value survives the null-payload re-import.
    expect(db.venues[0].row.whyWeCarry).toBe("Because Sean loves it");
  });
});

describe("executeImport — failure rolls the whole import back", () => {
  it("leaves the database empty when a write throws mid-transaction", async () => {
    const db = emptyDb();
    // Fail after 50 definitions are created — deep inside the batch.
    const store = createInMemoryStore(db, { failAfterDefinitions: 50 });

    await expect(
      executeImport(store, PLAN, { restaurantId: ECHO, apply: true }),
    ).rejects.toThrow(/injected failure/);

    // Nothing persisted — the partial writes were rolled back.
    expect(db.definitions).toHaveLength(0);
    expect(db.venues).toHaveLength(0);
    expect(db.pours).toHaveLength(0);
    expect(db.observations).toHaveLength(0);
  });
});
