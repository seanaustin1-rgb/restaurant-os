import { describe, it, expect } from "vitest";
import {
  validateSpirit,
  isSpiritPublishable,
  lifecycleRank,
  FLAVOR_AXES,
  type SpiritValidationInput,
  type PourValidationInput,
} from "./validate";

// A fully valid, publishable spirit — every test starts from a clone of this and
// breaks exactly one thing, so each assertion isolates a single rule.
function goodFlavor(): Record<string, number> {
  return { Sweet: 6, Oak: 5, Spice: 4, Fruit: 4, Smoke: 1, Earth: 3, Herbal: 2 };
}

function goodPours(): PourValidationInput[] {
  return [
    { pourSizeOz: 2, priceUsd: 14, isPrimary: true },
    { pourSizeOz: 1, priceUsd: 8, isPrimary: false },
  ];
}

function publishedSpirit(over: Partial<SpiritValidationInput> = {}): SpiritValidationInput {
  return {
    slug: "penelope-barrel-strength",
    brand: "Penelope",
    category: "Bourbon",
    recordStatus: "PUBLISHED",
    publicationStatus: "PUBLISHED",
    body: 6,
    finish: 7,
    topNotes: ["Caramel depth", "Toasted oak", "Baking spice"],
    whyShort: "A high-proof wheated blend that stays approachable.",
    flavor: goodFlavor(),
    pours: goodPours(),
    ...over,
  };
}

describe("lifecycleRank", () => {
  it("orders DRAFT < REVIEWED < PUBLISHED", () => {
    expect(lifecycleRank("DRAFT")).toBeLessThan(lifecycleRank("REVIEWED"));
    expect(lifecycleRank("REVIEWED")).toBeLessThan(lifecycleRank("PUBLISHED"));
  });
});

describe("validateSpirit — a clean published record", () => {
  it("passes with no errors", () => {
    expect(validateSpirit(publishedSpirit())).toEqual([]);
    expect(isSpiritPublishable(publishedSpirit())).toBe(true);
  });

  it("reads pours off the spirit when not passed explicitly", () => {
    const s = publishedSpirit();
    expect(validateSpirit(s)).toEqual([]);
  });
});

describe("validateSpirit — always-on invariants", () => {
  it("rejects publicationStatus outranking recordStatus", () => {
    const errs = validateSpirit(
      publishedSpirit({ recordStatus: "DRAFT", publicationStatus: "PUBLISHED" }),
    );
    expect(errs.some((e) => e.field === "publicationStatus")).toBe(true);
  });

  it("allows a well-ordered draft (record REVIEWED, publication DRAFT)", () => {
    // Not guest-visible, so content rules don't apply; ordering is fine.
    const errs = validateSpirit({
      slug: "draft-bottle",
      brand: "X",
      category: "Rye",
      recordStatus: "REVIEWED",
      publicationStatus: "DRAFT",
      pours: [],
    });
    expect(errs).toEqual([]);
  });

  it.each([
    ["body", { body: 11 }],
    ["body", { body: -1 }],
    ["finish", { finish: 20 }],
    ["body", { body: 5.5 }],
  ])("rejects out-of-range %s", (field, over) => {
    const errs = validateSpirit(publishedSpirit(over as Partial<SpiritValidationInput>));
    expect(errs.some((e) => e.field === field)).toBe(true);
  });

  it("requires brand, category, and a well-formed slug", () => {
    const errs = validateSpirit(
      publishedSpirit({ slug: "Not A Slug", brand: "  ", category: "" }),
    );
    expect(errs.some((e) => e.field === "slug")).toBe(true);
    expect(errs.some((e) => e.field === "brand")).toBe(true);
    expect(errs.some((e) => e.field === "category")).toBe(true);
  });

  it("accepts a canonical slug and rejects underscores/uppercase", () => {
    expect(validateSpirit(publishedSpirit({ slug: "old-forester-1920" }))).toEqual([]);
    expect(
      validateSpirit(publishedSpirit({ slug: "old_forester" })).some((e) => e.field === "slug"),
    ).toBe(true);
  });

  it("rejects more than one primary pour even for a draft", () => {
    const errs = validateSpirit({
      slug: "d",
      brand: "X",
      category: "Rye",
      recordStatus: "DRAFT",
      publicationStatus: "DRAFT",
      pours: [
        { isPrimary: true },
        { isPrimary: true },
      ],
    });
    expect(errs.some((e) => e.field === "pours")).toBe(true);
  });

  it("rejects a non-positive pour size and negative price", () => {
    const errs = validateSpirit(
      publishedSpirit({
        pours: [{ pourSizeOz: 0, priceUsd: -1, isPrimary: true }],
      }),
    );
    expect(errs.some((e) => e.field === "pours[0].pourSizeOz")).toBe(true);
    expect(errs.some((e) => e.field === "pours[0].priceUsd")).toBe(true);
  });
});

describe("validateSpirit — guest-visibility (publish) rules", () => {
  it("requires exactly 3 non-empty topNotes", () => {
    expect(
      validateSpirit(publishedSpirit({ topNotes: ["only", "two"] })).some(
        (e) => e.field === "topNotes",
      ),
    ).toBe(true);
    expect(
      validateSpirit(publishedSpirit({ topNotes: ["a", "b", "  "] })).some(
        (e) => e.field === "topNotes",
      ),
    ).toBe(true);
  });

  it("requires a whyShort", () => {
    expect(
      validateSpirit(publishedSpirit({ whyShort: "" })).some((e) => e.field === "whyShort"),
    ).toBe(true);
  });

  it("requires all seven flavor axes as 0–10 integers", () => {
    const missing = { ...goodFlavor() } as Record<string, number>;
    delete missing.Herbal;
    expect(
      validateSpirit(publishedSpirit({ flavor: missing })).some((e) => e.field === "flavor"),
    ).toBe(true);

    const outOfRange = { ...goodFlavor(), Smoke: 99 };
    expect(
      validateSpirit(publishedSpirit({ flavor: outOfRange })).some((e) => e.field === "flavor"),
    ).toBe(true);
  });

  it("exposes all seven axes via FLAVOR_AXES", () => {
    expect(FLAVOR_AXES).toHaveLength(7);
    expect([...FLAVOR_AXES].sort()).toEqual(
      ["Earth", "Fruit", "Herbal", "Oak", "Smoke", "Spice", "Sweet"].sort(),
    );
  });

  it("requires at least one pour and exactly one primary", () => {
    expect(
      validateSpirit(publishedSpirit({ pours: [] })).some((e) => e.field === "pours"),
    ).toBe(true);

    expect(
      validateSpirit(
        publishedSpirit({ pours: [{ priceUsd: 14, isPrimary: false }] }),
      ).some((e) => e.field === "pours"),
    ).toBe(true);
  });

  it("requires the primary pour to be priced", () => {
    const errs = validateSpirit(
      publishedSpirit({ pours: [{ pourSizeOz: 2, priceUsd: null, isPrimary: true }] }),
    );
    expect(errs.some((e) => e.field === "pours")).toBe(true);
  });

  it("does NOT apply content rules to a draft (topNotes/flavor/pours may be absent)", () => {
    const draft: SpiritValidationInput = {
      slug: "pending-bottle",
      brand: "Newcomer",
      category: "Bourbon",
      recordStatus: "DRAFT",
      publicationStatus: "DRAFT",
      // no topNotes, no flavor, no pours — legitimately incomplete
    };
    expect(validateSpirit(draft)).toEqual([]);
  });
});
