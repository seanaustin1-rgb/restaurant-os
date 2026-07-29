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
      async updatePour(pourId, _restaurantId, row) {
        const p = state.pours.find((x) => x.id === pourId);
        if (!p) throw new Error("updatePour: not found");
        p.row = row;
        p.toastItemGuid = row.toastItemGuid;
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

describe("executeImport — dry-run", () => {
  it("writes nothing and reports the intended totals", async () => {
    const db = emptyDb();
    const store = createInMemoryStore(db);
    const report = await executeImport(store, PLAN, { restaurantId: ECHO }); // apply omitted

    expect(report.dryRun).toBe(true);
    expect(report.definitions).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    expect(report.priceObservations).toEqual({ inserted: 0, skipped: 0 });
    expect(db.definitions).toHaveLength(0);
    expect(db.venues).toHaveLength(0);
    expect(db.pours).toHaveLength(0);
    expect(db.observations).toHaveLength(0);
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
