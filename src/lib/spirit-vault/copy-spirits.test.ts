import { describe, expect, it, vi } from "vitest";
import {
  COPY_TABLES, parseCopyArgs, validateCopyUrls, planSpiritCopy, finishSpiritCopy,
  normalizedJson, type Column, type CopyOptions, type ForeignKey, type Row, type Snapshot, type TableSnapshot,
} from "./copy-spirits";
import { identifier, upsertRow } from "../../../scripts/one-off/copy-spirits-store";

const options: CopyOptions = { sourceRestaurant: "demo-restaurant", targetRestaurant: "real-restaurant", apply: false };
const id: Column = { name: "id", type: "text", nullable: false };
const tenant: Column = { name: "restaurantId", type: "text", nullable: false };
function table(rows: Row[] = [], extras: Partial<TableSnapshot> = {}): TableSnapshot {
  return { columns: [id, tenant], uniqueKeys: [["id"]], foreignKeys: [], rows, total: rows.length, ...extras };
}
function empty(): Snapshot {
  return Object.fromEntries(COPY_TABLES.map((name) => [name, table([], name === "SpiritDefinition" ? { columns: [id, { name: "slug", type: "text", nullable: false }], uniqueKeys: [["id"], ["slug"]] } : {})]));
}
function fixture() {
  const source = empty();
  const target = empty();
  source.SpiritDefinition!.rows = [{ id: "def", slug: "bourbon", proofN: "100.00", flavor: '{"Sweet":5}', createdAt: new Date("2026-01-01T00:00:00Z") }];
  source.SpiritDefinition!.total = 1;
  const venueFk: ForeignKey = { columns: ["spiritDefinitionId"], table: "SpiritDefinition", referencedColumns: ["id"] };
  const restaurantFk: ForeignKey = { columns: ["restaurantId"], table: "Restaurant", referencedColumns: ["id"] };
  for (const snapshot of [source, target]) snapshot.VenueSpirit!.foreignKeys = [venueFk, restaurantFk];
  source.VenueSpirit!.rows = [{ id: "venue", restaurantId: options.sourceRestaurant, spiritDefinitionId: "def", slug: "bourbon", publicationStatus: "DRAFT" }];
  source.VenueSpirit!.total = 1;
  const pourFk: ForeignKey = { columns: ["venueSpiritId", "restaurantId"], table: "VenueSpirit", referencedColumns: ["id", "restaurantId"] };
  for (const snapshot of [source, target]) snapshot.SpiritPour!.foreignKeys = [pourFk];
  source.SpiritPour!.rows = [{ id: "pour", restaurantId: options.sourceRestaurant, venueSpiritId: "venue", priceUsd: "12.50", toastItemGuid: "toast-guid" }];
  source.SpiritPour!.total = 1;
  return { source, target };
}
const exists = async () => true;

describe("one-time Spirit copy argument and connection guards", () => {
  it("requires both restaurant IDs even in default dry-run", () => {
    expect(() => parseCopyArgs([])).toThrow("Both");
    expect(() => parseCopyArgs(["--source-restaurant=x"])).toThrow("Both");
    expect(() => parseCopyArgs(["--target-restaurant", "x"])).toThrow("Both");
  });
  it("defaults to dry-run and requires the exact --apply flag", () => {
    const args = ["--source-restaurant", "demo", "--target-restaurant=prod"];
    expect(parseCopyArgs(args).apply).toBe(false);
    expect(parseCopyArgs([...args, "--dry-run"]).apply).toBe(false);
    expect(parseCopyArgs([...args, "--apply"]).apply).toBe(true);
    expect(() => parseCopyArgs([...args, "--apply", "--dry-run"])).toThrow("Choose");
    expect(() => parseCopyArgs([...args, "--include=GuestMembership"])).toThrow("Unknown");
  });
  it("rejects reversed projects, localhost, misleading hosts and transaction pooling without leaking passwords", () => {
    const demo = "postgresql://postgres:never-print@db.jzjscsoasfjsxekyfrgi.supabase.co:5432/postgres";
    const prod = "postgresql://postgres:never-print@db.rweclputxgwutykinlbr.supabase.co:5432/postgres";
    expect(validateCopyUrls(demo, prod)).toEqual({ source: demo, target: prod });
    for (const bad of [prod, "postgres://postgres:never-print@localhost/postgres", demo.replace(".co", ".co.evil")]) {
      let message = "";
      try { validateCopyUrls(bad, prod); } catch (error) { message = (error as Error).message; }
      expect(message).toBeTruthy();
      expect(message).not.toContain("never-print");
    }
    expect(() => validateCopyUrls(demo, "postgres://postgres.rweclputxgwutykinlbr:never-print@aws-1-us-west-2.pooler.supabase.com:6543/postgres")).toThrow("transaction pooling");
    expect(() => validateCopyUrls(undefined, prod)).toThrow("SOURCE_URL");
  });
});

describe("Spirit copy planning", () => {
  it("preserves shared catalog rows and all stable IDs, remapping only venue restaurant IDs", async () => {
    const { source, target } = fixture();
    const plan = await planSpiritCopy(source, target, options, exists);
    expect(plan.gaps).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(plan.tables[0].writes[0].row).toEqual(source.SpiritDefinition!.rows[0]);
    expect(plan.tables[1].writes[0].row).toMatchObject({ id: "venue", restaurantId: options.targetRestaurant, spiritDefinitionId: "def", publicationStatus: "DRAFT" });
    expect(plan.tables[2].writes[0].row).toMatchObject({ id: "pour", restaurantId: options.targetRestaurant, venueSpiritId: "venue", priceUsd: "12.50", toastItemGuid: "toast-guid" });
    expect(source.VenueSpirit!.rows[0].restaurantId).toBe(options.sourceRestaurant);
  });
  it("skips identical rows on a second copy without changing timestamps", async () => {
    const { source, target } = fixture();
    const first = await planSpiritCopy(source, target, options, exists);
    for (const p of first.tables) target[p.table]!.rows = p.writes.map(({ row }) => row);
    const second = await planSpiritCopy(source, target, options, exists);
    expect(second.tables.every((p) => p.inserted === 0 && p.updated === 0 && p.writes.length === 0)).toBe(true);
    expect(second.tables.slice(0, 3).map((p) => p.skipped)).toEqual([1, 1, 1]);
  });
  it("remaps every tenant table while preserving flight, pour and observation references", async () => {
    const { source, target } = fixture();
    source.SpiritFlight!.rows = [{ id: "flight", restaurantId: options.sourceRestaurant, name: "Flight", pricingSnapshot: '{"lines":[{"spiritPourId":"pour"}]}' }];
    source.SpiritFlightItem!.rows = [{ id: "item", restaurantId: options.sourceRestaurant, flightId: "flight", venueSpiritId: "venue", spiritPourId: "pour", sortOrder: 0 }];
    source.SpiritPriceObservation!.rows = [{ id: "observation", restaurantId: options.sourceRestaurant, offerId: "pour", priceUsd: "12.50" }];
    source.CustomFlightTemplate!.rows = [{ id: "template", restaurantId: options.sourceRestaurant, slots: '[]' }];
    for (const name of COPY_TABLES) source[name]!.total = source[name]!.rows.length;
    const plan = await planSpiritCopy(source, target, options, exists);
    expect(plan.tables.slice(1).every((p) => p.writes[0].row.restaurantId === options.targetRestaurant)).toBe(true);
    expect(plan.tables.find((p) => p.table === "SpiritFlightItem")!.writes[0].row).toMatchObject({ flightId: "flight", venueSpiritId: "venue", spiritPourId: "pour", sortOrder: 0 });
    expect(plan.tables.find((p) => p.table === "SpiritPriceObservation")!.writes[0].row.offerId).toBe("pour");
  });
  it("updates an existing catalog row by the same ID/slug", async () => {
    const { source, target } = fixture();
    target.SpiritDefinition!.rows = [{ ...source.SpiritDefinition!.rows[0], proofN: "90.00" }];
    const plan = await planSpiritCopy(source, target, options, exists);
    expect(plan.tables[0].updated).toBe(1);
    expect(plan.tables[0].writes[0].row.proofN).toBe("100.00");
  });
  it("refuses same slug with different ID and same ID with different slug", async () => {
    const { source, target } = fixture();
    target.SpiritDefinition!.rows = [{ id: "different-id", slug: "bourbon" }];
    expect((await planSpiritCopy(source, target, options, exists)).conflicts.join()).toContain("unique key (slug)");
    target.SpiritDefinition!.rows = [{ id: "def", slug: "different-slug" }];
    expect((await planSpiritCopy(source, target, options, exists)).conflicts.join()).toContain("different slug");
  });
  it("does not take over another restaurant's row with the same ID", async () => {
    const { source, target } = fixture();
    target.VenueSpirit!.rows = [{ ...source.VenueSpirit!.rows[0], restaurantId: "other-real-tenant" }];
    const plan = await planSpiritCopy(source, target, options, exists);
    expect(plan.conflicts.join()).toContain("another target restaurant");
    expect(plan.tables[1].writes).toEqual([]);
  });
  it("reports rows from other source restaurants as skipped", async () => {
    const { source, target } = fixture();
    source.VenueSpirit!.total = 7;
    expect((await planSpiritCopy(source, target, options, exists)).tables[1].skipped).toBe(6);
  });
  it("reports missing parents and mismatched composite restaurant foreign keys", async () => {
    const { source, target } = fixture();
    source.SpiritPour!.rows[0].venueSpiritId = "missing-venue";
    const plan = await planSpiritCopy(source, target, options, async () => false);
    expect(plan.gaps.join()).toContain("missing Restaurant");
    expect(plan.gaps.join()).toContain("missing VenueSpirit");
  });
  it("fails closed on schema drift and required missing tables", async () => {
    const { source, target } = fixture();
    target.SpiritPour!.columns = [id];
    delete target.SpiritFlightItem;
    const plan = await planSpiritCopy(source, target, options, exists);
    expect(plan.gaps.join()).toContain("SpiritPour: source/target columns");
    expect(plan.gaps.join()).toContain("SpiritFlightItem: target table is missing");
  });
  it("copies optional custom templates only when both schemas exist", async () => {
    const { source, target } = fixture();
    source.CustomFlightTemplate!.rows = [{ id: "template", restaurantId: options.sourceRestaurant, slots: '[]' }];
    source.CustomFlightTemplate!.total = 1;
    delete target.CustomFlightTemplate;
    expect((await planSpiritCopy(source, target, options, exists)).gaps.join()).toContain("CustomFlightTemplate: target table");
    delete source.CustomFlightTemplate;
    expect((await planSpiritCopy(source, target, options, exists)).gaps).toEqual([]);
  });
  it("never copies guest, membership, redemption, code or unlisted tables", async () => {
    const { source, target } = fixture();
    Object.assign(source, { GuestMembership: table([{ id: "private" }]), TestSpirit: table([{ id: "test" }]), MembershipCode: table([{ id: "code" }]) });
    const plan = await planSpiritCopy(source, target, options, exists);
    expect(plan.tables.map((p) => p.table)).toEqual([...COPY_TABLES]);
    expect(plan.tables.flatMap((p) => p.writes).map((w) => w.row.id)).not.toContain("private");
  });
  it("refuses to rewrite append-only price observations", async () => {
    const { source, target } = fixture();
    source.SpiritPriceObservation!.rows = [{ id: "obs", restaurantId: options.sourceRestaurant, priceUsd: "12.00" }];
    source.SpiritPriceObservation!.total = 1;
    target.SpiritPriceObservation!.rows = [{ id: "obs", restaurantId: options.targetRestaurant, priceUsd: "10.00" }];
    expect((await planSpiritCopy(source, target, options, exists)).conflicts.join()).toContain("append-only");
  });
});

describe("Spirit copy write boundary and SQL serialization", () => {
  it("never invokes writes in default dry-run and refuses all writes when gaps exist", async () => {
    const { source, target } = fixture();
    const plan = await planSpiritCopy(source, target, options, exists);
    const upsert = vi.fn();
    await finishSpiritCopy(plan, { upsert }, false);
    expect(upsert).not.toHaveBeenCalled();
    plan.gaps.push("missing parent");
    await expect(finishSpiritCopy(plan, { upsert }, true)).rejects.toThrow("Preflight");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("writes parents before dependents and propagates an error without continuing", async () => {
    const { source, target } = fixture();
    const plan = await planSpiritCopy(source, target, options, exists);
    const upsert = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("constraint failure"));
    await expect(finishSpiritCopy(plan, { upsert }, true)).rejects.toThrow("constraint failure");
    expect(upsert.mock.calls.map((call) => call[0])).toEqual(["SpiritDefinition", "VenueSpirit"]);
  });
  it("parameterizes all row data and distinguishes JSON null from SQL NULL", async () => {
    const execute = vi.fn().mockResolvedValue(1);
    const db = { $executeRawUnsafe: execute, $queryRawUnsafe: vi.fn() };
    const columns = [id, { name: "flavor", type: "jsonb", nullable: true }];
    const payload = { id: "literal' ; DROP TABLE anything; --", flavor: "null" };
    await upsertRow(db, "SpiritDefinition", columns, payload);
    expect(execute.mock.calls[0][0]).toContain("($1::jsonb->>'flavor')::jsonb");
    expect(execute.mock.calls[0][0]).not.toContain(payload.id);
    expect(JSON.parse(execute.mock.calls[0][1])).toEqual(payload);
    expect(normalizedJson({ flavor: null })).not.toBe(normalizedJson({ flavor: "null" }));
    expect(() => identifier('SpiritDefinition"; DROP TABLE x')).toThrow("identifier");
  });
});
