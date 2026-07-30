import { describe, expect, it } from "vitest";
import { listingToVaultRecord, buildVaultPayloadScript, type VaultListingInput } from "./vault-payload";

const baseListing: VaultListingInput = {
  id: "venue-1",
  slug: "sample-rye",
  whyWeCarry: null,
  seanShort: "Ask for it neat.",
  notes: null,
  recordStatus: "PUBLISHED",
  publicationStatus: "PUBLISHED",
  definition: {
    slug: "sample-rye",
    verificationStatus: "SOURCED",
    brand: "Sample",
    expression: "Rye",
    displayName: "Sample Rye",
    category: "Rye",
    style: "Straight Rye Whiskey",
    proofN: { toString: () => "99.5" },
    proofDisplay: null,
    ageText: "5 yr",
    body: 6,
    finish: 7,
    flavor: { Sweet: 4, Oak: 5, Spice: 8, Fruit: 3, Smoke: 1, Earth: 3, Herbal: 4 },
    topNotes: ["Rye spice", "Dark fruit", "Oak"],
    whyShort: "A focused rye pour.",
    why: "Built for rye drinkers.",
    knowledgeReviewedAt: "2026-07-30",
  },
  offers: [
    {
      isPrimary: true,
      priceUsd: { toString: () => "12.50" },
      pourSizeOz: { toString: () => "1.5" },
      pourLabel: "1.5 oz pour",
      toastItemGuid: "toast-guid",
      availability: "In stock",
      priceIsTemporary: false,
      priceProvenance: "Toast menu.",
      commerceSource: "TOAST",
      syncedAt: "2026-07-30",
    },
  ],
};

describe("listingToVaultRecord", () => {
  it("composes canonical rows into the guest engine contract", () => {
    const record = listingToVaultRecord(baseListing);

    expect(record).toMatchObject({
      id: "sample-rye",
      cat: "Rye",
      silo: "bourbon",
      name: "Sample Rye",
      proofN: 99.5,
      proof: "99.5",
      price: "$12.50",
      priceL: "1.5 oz pour",
      recordStatus: "published",
      publicationStatus: "published",
      verificationStatus: "source-reviewed",
      seanShort: "Ask for it neat.",
      reviewedAt: "2026-07-30",
    });
    expect(record.paths).toEqual({ lighter: [], similar: [], adventurous: [] });
    expect(record.dist).toMatchObject({ name: "Sample", place: "Pending", timeline: [] });
    expect(record.btb).toEqual({ stats: [], facts: [] });
    expect(record.commerce).toMatchObject({
      pourPriceUsd: 12.5,
      pourSizeOz: 1.5,
      toastItemGuid: "toast-guid",
      source: "toast",
    });
  });
});

describe("buildVaultPayloadScript", () => {
  it("serializes records into the window data hook", () => {
    const script = buildVaultPayloadScript([baseListing]);

    expect(script).toContain("window.SPIRIT_VAULT_DATA");
    expect(script).toContain("sample-rye");
    expect(script).toContain("1.5 oz pour");
  });
});
