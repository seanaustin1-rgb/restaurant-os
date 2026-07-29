import { describe, it, expect } from "vitest";
import { loadGuestRecords } from "./load-guest-records";
import type {
  SpiritDefinitionRow,
  VenueSpiritRow,
  SpiritPourRow,
} from "./transform";
import {
  planImport,
  executeImport,
  type SpiritImportStore,
  type SpiritImportTxStore,
  type StoredDefinition,
  type StoredVenueSpirit,
  type StoredPour,
} from "./import-spirits";

// ── The real vault, planned once ──
const RECORDS = loadGuestRecords();
const PLAN = planImport(RECORDS);

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
}

function createInMemoryStore(db: FakeDb, opts: FakeOptions = {}) {
  let seq = 0;
  const id = (p: string) => `${p}_${++seq}`;

  function txStore(state: FakeDb): SpiritImportTxStore {
    let createdDefs = 0;
    return {
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
        d.row = row;
      },

      async findVenueSpirit(restaurantId, slug) {
        return (
          state.venues.find((v) => v.restaurantId === restaurantId && v.slug === slug) ?? null
        );
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
      async updateVenueSpirit(venueId, row) {
        const v = state.venues.find((x) => x.id === venueId);
        if (!v) throw new Error("updateVenueSpirit: not found");
        v.row = row;
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

const ECHO = "echo-reserve-restaurant-id";

// ──────────────────────────────── Tests ────────────────────────────────

describe("planImport — real 110 records", () => {
  it("plans 110 records, 108 published, all writable", () => {
    expect(PLAN.totals.records).toBe(110);
    expect(PLAN.totals.published).toBe(108);
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
