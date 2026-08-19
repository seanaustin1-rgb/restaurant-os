import { describe, expect, it, vi } from "vitest";
import { isFlightPourUnavailable, loadFlightTemplateCandidates } from "./flight-template-candidates";

function row(
  id: string,
  overrides: {
    name?: string;
    brand?: string;
    expression?: string | null;
    category?: string;
    proofN?: number | null;
    production?: unknown;
    tags?: string[];
    availability?: string | null;
    toastItemGuid?: string | null;
    isPrimary?: boolean;
  } = {},
) {
  return {
    id,
    whyWeCarry: null,
    seanShort: null,
    definition: {
      brand: overrides.brand ?? overrides.name ?? id,
      expression: overrides.expression ?? null,
      displayName: overrides.name ?? null,
      category: overrides.category ?? "Bourbon",
      subcategory: null,
      style: null,
      proofN: overrides.proofN ?? null,
      proofDisplay: null,
      flavor: { Sweet: 8, Oak: 4 },
      production: overrides.production ?? null,
      productionStructured: null,
      prodTags: overrides.tags ?? [],
      topNotes: ["Caramel", "Oak", "Spice"],
    },
    offers: [
      {
        id: `${id}_pour`,
        toastItemGuid: overrides.toastItemGuid ?? null,
        pourSizeOz: 2,
        pourLabel: "2 oz",
        priceUsd: 16,
        availability: overrides.availability ?? "In stock",
        isPrimary: overrides.isPrimary ?? true,
        commerceSource: overrides.toastItemGuid ? "TOAST" : "MANUAL",
      },
    ],
  };
}

function dbWithRows(rows: ReturnType<typeof row>[]) {
  return { venueSpirit: { findMany: vi.fn().mockResolvedValue(rows) } };
}

describe("flight template candidates", () => {
  it("interprets common unavailable labels conservatively", () => {
    expect(isFlightPourUnavailable(null)).toBe(false);
    expect(isFlightPourUnavailable("In stock")).toBe(false);
    expect(isFlightPourUnavailable("Sold out")).toBe(true);
    expect(isFlightPourUnavailable("Temporarily unavailable")).toBe(true);
    expect(isFlightPourUnavailable("Hidden from menu")).toBe(true);
  });

  it("loads tenant-scoped published and priced pours", async () => {
    const db = dbWithRows([row("a", { proofN: 110 })]);

    await loadFlightTemplateCandidates("rest_1", "high-proof", db);

    expect(db.venueSpirit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          restaurantId: "rest_1",
          recordStatus: "PUBLISHED",
          publicationStatus: "PUBLISHED",
          offers: { some: { priceUsd: { not: null }, pourSizeOz: { not: null } } },
        },
      }),
    );
  });

  it("groups proof ascender candidates by proof slot", async () => {
    const db = dbWithRows([
      row("low", { name: "Low Proof", proofN: 90 }),
      row("bonded", { name: "Bonded Proof", proofN: 100 }),
      row("full", { name: "Full Proof", proofN: 110 }),
      row("cask", { name: "Cask Proof", proofN: 122 }),
    ]);

    const result = await loadFlightTemplateCandidates("rest_1", "proof-ascender", db);

    expect(result.groups.map((group) => [group.slot.key, group.candidates.map((candidate) => candidate.name)])).toEqual([
      ["approachable", ["Low Proof"]],
      ["classic", ["Bonded Proof"]],
      ["full-bodied", ["Full Proof"]],
      ["barrel-strength", ["Cask Proof"]],
    ]);
  });

  it("filters unavailable pours before returning candidates", async () => {
    const db = dbWithRows([
      row("available", { name: "Available Cask", proofN: 116 }),
      row("soldout", { name: "Sold Out Cask", proofN: 120, availability: "Sold out" }),
    ]);

    const result = await loadFlightTemplateCandidates("rest_1", "high-proof", db);

    expect(result.groups[0].candidates.map((candidate) => candidate.name)).toEqual(["Available Cask"]);
  });

  it("ranks Toast-backed pours before manual pours inside a template", async () => {
    const db = dbWithRows([
      row("manual", { name: "Manual High Proof", proofN: 105 }),
      row("toast", { name: "Toast High Proof", proofN: 110, toastItemGuid: "toast-guid" }),
    ]);

    const result = await loadFlightTemplateCandidates("rest_1", "high-proof", db);

    expect(result.groups[0].candidates.map((candidate) => candidate.name)).toEqual(["Toast High Proof", "Manual High Proof"]);
  });

  it("matches finished whiskey from production text and tags", async () => {
    const db = dbWithRows([
      row("finished", { name: "Port Finished Bourbon", proofN: 96, production: { finish: "Port cask" } }),
      row("tagged", { name: "Sherry Barrel Rye", proofN: 98, tags: ["sherry"] }),
      row("standard", { name: "Standard Bourbon", proofN: 96 }),
    ]);

    const result = await loadFlightTemplateCandidates("rest_1", "finished-whiskey", db);

    expect(result.groups[0].candidates.map((candidate) => candidate.name)).toEqual(["Port Finished Bourbon", "Sherry Barrel Rye"]);
  });
});
