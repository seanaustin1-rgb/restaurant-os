import { describe, expect, it } from "vitest";
import {
  listingToCandidatePours,
  matchesFlightTemplateRules,
  rankFlightCandidates,
  groupCandidatesByTemplateSlot,
  type FlightCandidatePour,
  type CandidateListingRow,
} from "./flight-template-candidates";
import type { FlightTemplate, FlightTemplateRules } from "./flight-templates";

// ── Test fixtures ──

function makePour(overrides: Partial<FlightCandidatePour> = {}): FlightCandidatePour {
  return {
    venueSpiritId: "vs_1",
    spiritPourId: "sp_1",
    name: "Buffalo Trace",
    category: "Bourbon",
    pourLabel: "2 oz",
    pourSizeOz: 2,
    priceUsd: 12,
    oneOzPriceUsd: 6,
    suggestedBites: ["Salted caramel"],
    proofN: 90,
    searchText: "buffalo trace bourbon",
    hasVenueVoice: false,
    toastUnitsSold: 0,
    ...overrides,
  };
}

function makeListing(overrides: Partial<CandidateListingRow> = {}): CandidateListingRow {
  return {
    id: "vs_1",
    whyWeCarry: null,
    seanShort: null,
    notes: null,
    overrides: null,
    definition: {
      brand: "Buffalo Trace",
      expression: null,
      displayName: null,
      subcategory: null,
      category: "Bourbon",
      style: "Kentucky Straight",
      proofN: { toString: () => "90" },
      prodTags: ["corn", "limestone water"],
      production: [{ k: "Mash bill", v: "low rye" }],
      flavor: { Sweet: 6, Oak: 5, Spice: 4 },
    },
    offers: [
      { id: "sp_1", toastItemGuid: "GUID_1", pourLabel: "2 oz", pourSizeOz: { toString: () => "2.0" }, priceUsd: { toString: () => "12.00" } },
    ],
    ...overrides,
  };
}

const proofAscender: FlightTemplate = {
  key: "proof-ascender",
  name: "Proof Ascender",
  description: "Ladder",
  throughLine: "...",
  maxPours: 4,
  autoOrder: "slot-order",
  slots: [
    { key: "entry", label: "80-92 proof", rules: { proofMin: 80, proofMax: 92 }, itemNote: "Light entry." },
    { key: "core", label: "93-100 proof", rules: { proofMin: 93, proofMax: 100 }, itemNote: "Balanced core." },
    { key: "dense", label: "105-115 proof", rules: { proofMin: 105, proofMax: 115 }, itemNote: "Dense." },
    { key: "barrel", label: "116+ proof", rules: { proofMin: 116 }, itemNote: "Barrel-proof." },
  ],
};

// ── listingToCandidatePours ──

describe("listingToCandidatePours", () => {
  it("converts a listing with a priced offer into a candidate", () => {
    const candidates = listingToCandidatePours(makeListing());
    expect(candidates).toHaveLength(1);
    const c = candidates[0];
    expect(c.venueSpiritId).toBe("vs_1");
    expect(c.spiritPourId).toBe("sp_1");
    expect(c.name).toBe("Buffalo Trace");
    expect(c.oneOzPriceUsd).toBe(6);
    expect(c.proofN).toBe(90);
    expect(c.hasVenueVoice).toBe(false);
    expect(c.toastUnitsSold).toBe(0);
  });

  it("uses displayName over brand+expression when present", () => {
    const listing = makeListing();
    listing.definition.displayName = "BT Single Barrel Select";
    listing.definition.brand = "Buffalo Trace";
    listing.definition.expression = "Single Barrel";
    const [c] = listingToCandidatePours(listing);
    expect(c.name).toBe("BT Single Barrel Select");
  });

  it("falls back to style then category when displayName and brand/expression are empty", () => {
    const listing = makeListing();
    listing.definition.displayName = null;
    listing.definition.brand = "";
    listing.definition.expression = null;
    const [c] = listingToCandidatePours(listing);
    expect(c.name).toBe("Kentucky Straight");

    listing.definition.style = null;
    const [c2] = listingToCandidatePours(listing);
    expect(c2.name).toBe("Bourbon");
  });

  it("falls back to style when brand is whitespace-only", () => {
    const listing = makeListing();
    listing.definition.displayName = null;
    listing.definition.brand = " ";
    listing.definition.expression = null;
    const [c] = listingToCandidatePours(listing);
    expect(c.name).toBe("Kentucky Straight");
  });

  it("sets hasVenueVoice when whyWeCarry is present", () => {
    const listing = makeListing({ whyWeCarry: "This is a cornerstone." });
    const [c] = listingToCandidatePours(listing);
    expect(c.hasVenueVoice).toBe(true);
  });

  it("sets hasVenueVoice when seanShort is present", () => {
    const [c] = listingToCandidatePours(makeListing({ seanShort: "Dependable." }));
    expect(c.hasVenueVoice).toBe(true);
  });

  it("sets hasVenueVoice when notes is present", () => {
    const [c] = listingToCandidatePours(makeListing({ notes: "Good for beginners." }));
    expect(c.hasVenueVoice).toBe(true);
  });

  it("resolves Toast units sold from the guid map", () => {
    const guids = new Map([["GUID_1", 42]]);
    const [c] = listingToCandidatePours(makeListing(), guids);
    expect(c.toastUnitsSold).toBe(42);
  });

  it("drops offers that lack priceUsd or pourSizeOz", () => {
    const listing = makeListing({
      offers: [
        { id: "sp_1", toastItemGuid: null, pourLabel: "2 oz", pourSizeOz: null, priceUsd: { toString: () => "12" } },
        { id: "sp_2", toastItemGuid: null, pourLabel: "1 oz", pourSizeOz: { toString: () => "1" }, priceUsd: null },
        { id: "sp_3", toastItemGuid: null, pourLabel: "taste", pourSizeOz: { toString: () => "0" }, priceUsd: { toString: () => "5" } },
      ],
    });
    expect(listingToCandidatePours(listing)).toHaveLength(0);
  });

  it("builds search text from identity and production fields", () => {
    const listing = makeListing();
    listing.definition.expression = "Single Barrel";
    listing.definition.subcategory = "Kentucky";
    const [c] = listingToCandidatePours(listing);
    expect(c.searchText).toContain("buffalo trace");
    expect(c.searchText).toContain("single barrel");
    expect(c.searchText).toContain("bourbon");
    expect(c.searchText).toContain("kentucky");
    expect(c.searchText).toContain("corn");
    expect(c.searchText).toContain("low rye");
  });
});

// ── matchesFlightTemplateRules ──

describe("matchesFlightTemplateRules", () => {
  it("passes an empty rule set — anything goes", () => {
    expect(matchesFlightTemplateRules(makePour(), {})).toBe(true);
  });

  it("enforces proofMin", () => {
    const rules: FlightTemplateRules = { proofMin: 100 };
    expect(matchesFlightTemplateRules(makePour({ proofN: 100 }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ proofN: 99 }), rules)).toBe(false);
    expect(matchesFlightTemplateRules(makePour({ proofN: null }), rules)).toBe(false);
  });

  it("enforces proofMax", () => {
    const rules: FlightTemplateRules = { proofMax: 92 };
    expect(matchesFlightTemplateRules(makePour({ proofN: 92 }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ proofN: 93 }), rules)).toBe(false);
    expect(matchesFlightTemplateRules(makePour({ proofN: null }), rules)).toBe(false);
  });

  it("enforces both proofMin and proofMax as a band", () => {
    const rules: FlightTemplateRules = { proofMin: 93, proofMax: 100 };
    expect(matchesFlightTemplateRules(makePour({ proofN: 96 }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ proofN: 100 }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ proofN: 92 }), rules)).toBe(false);
    expect(matchesFlightTemplateRules(makePour({ proofN: 101 }), rules)).toBe(false);
  });

  it("excludes null-proof bottles from proof-bounded rules", () => {
    expect(matchesFlightTemplateRules(makePour({ proofN: null }), { proofMin: 80 })).toBe(false);
  });

  it("enforces categories (case insensitive)", () => {
    const rules: FlightTemplateRules = { categories: ["Rye"] };
    expect(matchesFlightTemplateRules(makePour({ category: "Rye" }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ category: "rye" }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ category: "Bourbon" }), rules)).toBe(false);
  });

  it("enforces searchTerms (substring, case insensitive)", () => {
    const rules: FlightTemplateRules = { searchTerms: ["port", "sherry"] };
    expect(matchesFlightTemplateRules(makePour({ searchText: "port cask finished bourbon" }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ searchText: "oloroso sherry finish" }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ searchText: "standard bourbon" }), rules)).toBe(false);
  });

  it("enforces requiresBottledInBond — must say bonded AND proof must be 100", () => {
    const rules: FlightTemplateRules = { requiresBottledInBond: true };
    expect(matchesFlightTemplateRules(makePour({ proofN: 100, searchText: "heaven hill bottled-in-bond" }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ proofN: 100, searchText: "bonded bourbon" }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ proofN: 100, searchText: "bib bourbon" }), rules)).toBe(true);
    // 100 proof but no bonded wording
    expect(matchesFlightTemplateRules(makePour({ proofN: 100, searchText: "standard bourbon" }), rules)).toBe(false);
    // Bonded wording but wrong proof
    expect(matchesFlightTemplateRules(makePour({ proofN: 90, searchText: "bottled in bond" }), rules)).toBe(false);
  });

  it("enforces requiresVenueVoice", () => {
    const rules: FlightTemplateRules = { requiresVenueVoice: true };
    expect(matchesFlightTemplateRules(makePour({ hasVenueVoice: true }), rules)).toBe(true);
    expect(matchesFlightTemplateRules(makePour({ hasVenueVoice: false }), rules)).toBe(false);
  });

  it("intersects multiple rules — all must pass", () => {
    const rules: FlightTemplateRules = { proofMin: 100, proofMax: 100, requiresBottledInBond: true, searchTerms: ["bottled-in-bond"] };
    const pass = makePour({ proofN: 100, searchText: "heaven hill bottled-in-bond bourbon" });
    expect(matchesFlightTemplateRules(pass, rules)).toBe(true);
    // Fails: proof is 90
    const fail = makePour({ proofN: 90, searchText: "heaven hill bottled-in-bond bourbon" });
    expect(matchesFlightTemplateRules(fail, rules)).toBe(false);
  });
});

// ── rankFlightCandidates ──

describe("rankFlightCandidates", () => {
  it("ranks by Toast units sold (descending), price (ascending), name, then id", () => {
    const a = makePour({ spiritPourId: "sp_a", name: "Alpha", toastUnitsSold: 10, oneOzPriceUsd: 8 });
    const b = makePour({ spiritPourId: "sp_b", name: "Beta", toastUnitsSold: 20, oneOzPriceUsd: 12 });
    const c = makePour({ spiritPourId: "sp_c", name: "Charlie", toastUnitsSold: 10, oneOzPriceUsd: 6 });
    const d = makePour({ spiritPourId: "sp_d", name: "Charlie", toastUnitsSold: 10, oneOzPriceUsd: 6 });

    const ranked = rankFlightCandidates([a, d, b, c]);
    expect(ranked.map((p) => p.spiritPourId)).toEqual(["sp_b", "sp_c", "sp_d", "sp_a"]);
  });

  it("is deterministic — same input always gives same output", () => {
    const pours = [
      makePour({ spiritPourId: "sp_1", name: "X", toastUnitsSold: 0, oneOzPriceUsd: 5 }),
      makePour({ spiritPourId: "sp_2", name: "A", toastUnitsSold: 0, oneOzPriceUsd: 5 }),
      makePour({ spiritPourId: "sp_3", name: "A", toastUnitsSold: 0, oneOzPriceUsd: 5 }),
    ];
    const r1 = rankFlightCandidates(pours).map((p) => p.spiritPourId);
    const r2 = rankFlightCandidates(pours).map((p) => p.spiritPourId);
    expect(r1).toEqual(r2);
    expect(r1).toEqual(["sp_2", "sp_3", "sp_1"]);
  });

  it("does not mutate the original array", () => {
    const orig = [makePour({ spiritPourId: "sp_1" }), makePour({ spiritPourId: "sp_2" })];
    const origIds = orig.map((p) => p.spiritPourId);
    rankFlightCandidates(orig);
    expect(orig.map((p) => p.spiritPourId)).toEqual(origIds);
  });
});

// ── groupCandidatesByTemplateSlot ──

describe("groupCandidatesByTemplateSlot", () => {
  it("assigns pours to the correct proof-ladder slots", () => {
    const pours = [
      makePour({ spiritPourId: "sp_entry", proofN: 86 }),
      makePour({ spiritPourId: "sp_core", proofN: 100 }),
      makePour({ spiritPourId: "sp_dense", proofN: 110 }),
      makePour({ spiritPourId: "sp_barrel", proofN: 130 }),
      makePour({ spiritPourId: "sp_gap", proofN: 102 }), // Falls between core and dense
    ];

    const result = groupCandidatesByTemplateSlot(proofAscender, pours);
    expect(result.templateKey).toBe("proof-ascender");
    expect(result.slots).toHaveLength(4);

    expect(result.slots[0].candidates.map((p) => p.spiritPourId)).toEqual(["sp_entry"]);
    expect(result.slots[1].candidates.map((p) => p.spiritPourId)).toEqual(["sp_core"]);
    expect(result.slots[2].candidates.map((p) => p.spiritPourId)).toEqual(["sp_dense"]);
    expect(result.slots[3].candidates.map((p) => p.spiritPourId)).toEqual(["sp_barrel"]);
  });

  it("reports empty slots", () => {
    const pours = [
      makePour({ spiritPourId: "sp_entry", proofN: 86 }),
      // no core, dense, or barrel candidates
    ];
    const result = groupCandidatesByTemplateSlot(proofAscender, pours);
    expect(result.emptySlotKeys).toEqual(["core", "dense", "barrel"]);
  });

  it("includes the flat matched pool", () => {
    const pours = [
      makePour({ spiritPourId: "sp_1", proofN: 86 }),
      makePour({ spiritPourId: "sp_2", proofN: 100 }),
      makePour({ spiritPourId: "sp_3", proofN: 50 }), // matches no slot
    ];
    const result = groupCandidatesByTemplateSlot(proofAscender, pours);
    expect(result.matched.map((p) => p.spiritPourId)).toEqual(["sp_1", "sp_2"]);
  });

  it("puts a pour in multiple slots when its proof spans ranges", () => {
    const singleSlotTemplate: FlightTemplate = {
      key: "test",
      name: "Test",
      description: "",
      throughLine: "",
      maxPours: 4,
      autoOrder: "slot-order",
      slots: [
        { key: "low", label: "80-100", rules: { proofMin: 80, proofMax: 100 }, itemNote: "" },
        { key: "mid", label: "90-110", rules: { proofMin: 90, proofMax: 110 }, itemNote: "" },
      ],
    };
    const pour = makePour({ spiritPourId: "sp_overlap", proofN: 95 });
    const result = groupCandidatesByTemplateSlot(singleSlotTemplate, [pour]);
    expect(result.slots[0].candidates.map((p) => p.spiritPourId)).toEqual(["sp_overlap"]);
    expect(result.slots[1].candidates.map((p) => p.spiritPourId)).toEqual(["sp_overlap"]);
  });

  it("handles a single-slot pool template (like High Proof)", () => {
    const highProof: FlightTemplate = {
      key: "high-proof",
      name: "High Proof",
      description: "",
      throughLine: "",
      maxPours: 4,
      autoOrder: "proof-asc",
      slots: [{ key: "pool", label: "100+", rules: { proofMin: 100 }, itemNote: "Manage the heat." }],
    };
    const pours = [
      makePour({ spiritPourId: "sp_1", proofN: 100, toastUnitsSold: 5 }),
      makePour({ spiritPourId: "sp_2", proofN: 130, toastUnitsSold: 20 }),
      makePour({ spiritPourId: "sp_3", proofN: 80, toastUnitsSold: 50 }), // below threshold
    ];
    const result = groupCandidatesByTemplateSlot(highProof, pours);
    expect(result.slots).toHaveLength(1);
    expect(result.slots[0].candidates.map((p) => p.spiritPourId)).toEqual(["sp_2", "sp_1"]);
    expect(result.emptySlotKeys).toEqual([]);
    expect(result.matched.map((p) => p.spiritPourId)).toEqual(["sp_2", "sp_1"]);
  });
});
