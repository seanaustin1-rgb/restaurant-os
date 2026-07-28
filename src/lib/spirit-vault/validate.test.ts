import { describe, it, expect } from "vitest";
import {
  validatePublishableSpirit,
  isSpiritPublishable,
  lifecycleRank,
  FLAVOR_AXES,
  type PublishableSpiritInput,
  type SpiritDefinitionInput,
  type VenueSpiritInput,
  type SpiritPourInput,
} from "./validate";

// A fully valid, publishable unit — every test starts from a clone of this and
// breaks exactly one thing, so each assertion isolates a single rule.
function goodFlavor(): Record<string, number> {
  return { Sweet: 6, Oak: 5, Spice: 4, Fruit: 4, Smoke: 1, Earth: 3, Herbal: 2 };
}

function goodDefinition(over: Partial<SpiritDefinitionInput> = {}): SpiritDefinitionInput {
  return {
    slug: "penelope-barrel-strength",
    brand: "Penelope",
    category: "Bourbon",
    body: 6,
    finish: 7,
    topNotes: ["Caramel depth", "Toasted oak", "Baking spice"],
    whyShort: "A high-proof wheated blend that stays approachable.",
    flavor: goodFlavor(),
    ...over,
  };
}

function goodVenueSpirit(over: Partial<VenueSpiritInput> = {}): VenueSpiritInput {
  return {
    slug: "penelope-barrel-strength",
    recordStatus: "PUBLISHED",
    publicationStatus: "PUBLISHED",
    ...over,
  };
}

function goodOffers(): SpiritPourInput[] {
  return [{ pourSizeOz: 1.5, priceUsd: 14, isPrimary: true }];
}

function publishable(over: Partial<PublishableSpiritInput> = {}): PublishableSpiritInput {
  return {
    definition: goodDefinition(),
    venueSpirit: goodVenueSpirit(),
    offers: goodOffers(),
    ...over,
  };
}

describe("lifecycleRank", () => {
  it("orders DRAFT < REVIEWED < PUBLISHED", () => {
    expect(lifecycleRank("DRAFT")).toBeLessThan(lifecycleRank("REVIEWED"));
    expect(lifecycleRank("REVIEWED")).toBeLessThan(lifecycleRank("PUBLISHED"));
  });
});

describe("validatePublishableSpirit — a clean published record", () => {
  it("passes with no errors", () => {
    expect(validatePublishableSpirit(publishable())).toEqual([]);
    expect(isSpiritPublishable(publishable())).toBe(true);
  });
});

describe("validatePublishableSpirit — always-on invariants", () => {
  it("rejects publicationStatus outranking recordStatus", () => {
    const errs = validatePublishableSpirit(
      publishable({ venueSpirit: goodVenueSpirit({ recordStatus: "DRAFT", publicationStatus: "PUBLISHED" }) }),
    );
    expect(errs.some((e) => e.field === "publicationStatus")).toBe(true);
  });

  it("allows a well-ordered draft (record REVIEWED, publication DRAFT)", () => {
    // Not guest-visible, so content rules don't apply; ordering is fine.
    const errs = validatePublishableSpirit({
      definition: { slug: "draft-bottle", brand: "X", category: "Rye" },
      venueSpirit: { slug: "draft-bottle", recordStatus: "REVIEWED", publicationStatus: "DRAFT" },
      offers: [],
    });
    expect(errs).toEqual([]);
  });

  it.each([
    ["body", { body: 11 }],
    ["body", { body: -1 }],
    ["finish", { finish: 20 }],
    ["body", { body: 5.5 }],
  ])("rejects out-of-range %s", (field, over) => {
    const errs = validatePublishableSpirit(
      publishable({ definition: goodDefinition(over as Partial<SpiritDefinitionInput>) }),
    );
    expect(errs.some((e) => e.field === field)).toBe(true);
  });

  it("requires brand and category", () => {
    const errs = validatePublishableSpirit(
      publishable({ definition: goodDefinition({ brand: "  ", category: "" }) }),
    );
    expect(errs.some((e) => e.field === "brand")).toBe(true);
    expect(errs.some((e) => e.field === "category")).toBe(true);
  });

  it("requires a well-formed venueSpirit slug", () => {
    const errs = validatePublishableSpirit(
      publishable({ venueSpirit: goodVenueSpirit({ slug: "Not A Slug" }) }),
    );
    expect(errs.some((e) => e.field === "venueSpirit.slug")).toBe(true);
  });

  it("requires a well-formed definition slug", () => {
    const errs = validatePublishableSpirit(
      publishable({ definition: goodDefinition({ slug: "old_forester" }) }),
    );
    expect(errs.some((e) => e.field === "definition.slug")).toBe(true);
  });

  it("accepts canonical slugs and rejects underscores/uppercase", () => {
    expect(
      validatePublishableSpirit(
        publishable({
          definition: goodDefinition({ slug: "old-forester-1920" }),
          venueSpirit: goodVenueSpirit({ slug: "old-forester-1920" }),
        }),
      ),
    ).toEqual([]);
    expect(
      validatePublishableSpirit(
        publishable({ venueSpirit: goodVenueSpirit({ slug: "Old_Forester" }) }),
      ).some((e) => e.field === "venueSpirit.slug"),
    ).toBe(true);
  });

  it("rejects more than one primary offer even for a draft", () => {
    const errs = validatePublishableSpirit({
      definition: { slug: "d", brand: "X", category: "Rye" },
      venueSpirit: { slug: "d", recordStatus: "DRAFT", publicationStatus: "DRAFT" },
      offers: [{ isPrimary: true }, { isPrimary: true }],
    });
    expect(errs.some((e) => e.field === "offers")).toBe(true);
  });

  it("rejects a non-positive pour size and negative price", () => {
    const errs = validatePublishableSpirit(
      publishable({ offers: [{ pourSizeOz: 0, priceUsd: -1, isPrimary: true }] }),
    );
    expect(errs.some((e) => e.field === "offers[0].pourSizeOz")).toBe(true);
    expect(errs.some((e) => e.field === "offers[0].priceUsd")).toBe(true);
  });
});

describe("validatePublishableSpirit — guest-visibility (publish) rules", () => {
  it("requires recordStatus PUBLISHED when publishing", () => {
    // Well-ordered (REVIEWED >= REVIEWED... but publication PUBLISHED needs record PUBLISHED)
    const errs = validatePublishableSpirit(
      publishable({ venueSpirit: goodVenueSpirit({ recordStatus: "REVIEWED", publicationStatus: "PUBLISHED" }) }),
    );
    expect(errs.some((e) => e.field === "recordStatus")).toBe(true);
  });

  it("requires exactly 3 non-empty topNotes", () => {
    expect(
      validatePublishableSpirit(
        publishable({ definition: goodDefinition({ topNotes: ["only", "two"] }) }),
      ).some((e) => e.field === "topNotes"),
    ).toBe(true);
    expect(
      validatePublishableSpirit(
        publishable({ definition: goodDefinition({ topNotes: ["a", "b", "  "] }) }),
      ).some((e) => e.field === "topNotes"),
    ).toBe(true);
  });

  it("requires a whyShort", () => {
    expect(
      validatePublishableSpirit(
        publishable({ definition: goodDefinition({ whyShort: "" }) }),
      ).some((e) => e.field === "whyShort"),
    ).toBe(true);
  });

  it("requires all seven flavor axes as 0–10 integers", () => {
    const missing = { ...goodFlavor() } as Record<string, number>;
    delete missing.Herbal;
    expect(
      validatePublishableSpirit(
        publishable({ definition: goodDefinition({ flavor: missing }) }),
      ).some((e) => e.field === "flavor"),
    ).toBe(true);

    const outOfRange = { ...goodFlavor(), Smoke: 99 };
    expect(
      validatePublishableSpirit(
        publishable({ definition: goodDefinition({ flavor: outOfRange }) }),
      ).some((e) => e.field === "flavor"),
    ).toBe(true);
  });

  it("exposes all seven axes via FLAVOR_AXES", () => {
    expect(FLAVOR_AXES).toHaveLength(7);
    expect([...FLAVOR_AXES].sort()).toEqual(
      ["Earth", "Fruit", "Herbal", "Oak", "Smoke", "Spice", "Sweet"].sort(),
    );
  });

  it("requires at least one offer and exactly one primary", () => {
    expect(
      validatePublishableSpirit(publishable({ offers: [] })).some((e) => e.field === "offers"),
    ).toBe(true);

    expect(
      validatePublishableSpirit(
        publishable({ offers: [{ pourSizeOz: 1.5, priceUsd: 14, isPrimary: false }] }),
      ).some((e) => e.field === "offers"),
    ).toBe(true);
  });

  it("requires the primary offer to be priced", () => {
    const errs = validatePublishableSpirit(
      publishable({ offers: [{ pourSizeOz: 1.5, priceUsd: null, isPrimary: true }] }),
    );
    expect(errs.some((e) => e.field === "offers")).toBe(true);
  });

  it("does NOT apply content rules to a draft (topNotes/flavor/offers may be absent)", () => {
    const draft: PublishableSpiritInput = {
      definition: { slug: "pending-bottle", brand: "Newcomer", category: "Bourbon" },
      venueSpirit: { slug: "pending-bottle", recordStatus: "DRAFT", publicationStatus: "DRAFT" },
      offers: [],
      // no topNotes, no flavor, no offers — legitimately incomplete
    };
    expect(validatePublishableSpirit(draft)).toEqual([]);
  });
});
