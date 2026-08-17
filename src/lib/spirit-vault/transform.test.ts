import { describe, it, expect } from "vitest";
import { loadGuestRecords } from "./load-guest-records";
import { guestRecordToRows, ECHO_TOAST_POUR_OZ } from "./transform";

// These run against the REAL static vault (docs/spirit-vault/*), reconstructed
// exactly as a guest's browser builds it — so the transform is proven on all
// 200 records (both the legacy, source-reviewed batch, and draft inventory
// shapes), not hand-picked fixtures.
const RECORDS = loadGuestRecords();
const ROWS = RECORDS.map(guestRecordToRows);

describe("loadGuestRecords", () => {
  it("reconstructs the full vault (200 records)", () => {
    expect(RECORDS.length).toBe(200);
    expect(ROWS.length).toBe(200);
  });
});

describe("guestRecordToRows — every record maps to the split shape", () => {
  it("gives each record definition + venueSpirit slugs, a category, and a non-empty brand", () => {
    for (const { definition, venueSpirit } of ROWS) {
      expect(definition.slug, JSON.stringify(definition)).toBeTruthy();
      expect(venueSpirit.slug, JSON.stringify(venueSpirit)).toBeTruthy();
      expect(definition.slug).toBe(venueSpirit.slug);
      expect(definition.category).toBeTruthy();
      expect(definition.brand.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps definition slugs unique (the canonical spirit id)", () => {
    const slugs = ROWS.map((r) => r.definition.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps venueSpirit slugs unique (the tenant-stable public id)", () => {
    const slugs = ROWS.map((r) => r.venueSpirit.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("produces exactly one primary offer per record", () => {
    for (const { offers } of ROWS) {
      expect(offers.length).toBe(1);
      expect(offers.filter((o) => o.isPrimary).length).toBe(1);
      expect(offers[0].isPrimary).toBe(true);
    }
  });

  it("never lets publicationStatus outrank recordStatus", () => {
    const rank = { DRAFT: 0, REVIEWED: 1, PUBLISHED: 2 } as const;
    for (const { venueSpirit } of ROWS) {
      expect(rank[venueSpirit.publicationStatus]).toBeLessThanOrEqual(
        rank[venueSpirit.recordStatus],
      );
    }
  });

  it("maps proof: numeric proofN wins, else a display label", () => {
    for (const { definition } of ROWS) {
      if (definition.proofN != null) {
        expect(typeof definition.proofN).toBe("number");
        expect(definition.proofDisplay).toBeNull();
      }
    }
  });
});

describe("guestRecordToRows — pour size is Echo's real 1.5 oz, not the legacy 2 oz", () => {
  it("records every primary offer at 1.5 oz with a '1.5 oz pour' label", () => {
    expect(ECHO_TOAST_POUR_OZ).toBe(1.5);
    for (const { offers } of ROWS) {
      expect(offers[0].pourSizeOz).toBe(1.5);
      expect(offers[0].pourLabel).toBe("1.5 oz pour");
    }
  });
});

describe("guestRecordToRows — legacy vs batch shapes both resolve", () => {
  it("legacy records (no commerce block) still get a priced 1.5 oz primary offer", () => {
    const legacy = ROWS.find((r) => r.definition.slug === "penelope-barrel-strength");
    expect(legacy).toBeDefined();
    expect(legacy!.venueSpirit.publicationStatus).toBe("PUBLISHED");
    expect(legacy!.offers[0].priceUsd).toBe(14); // parsed from the "$14" display string
    expect(legacy!.offers[0].pourSizeOz).toBe(1.5); // corrected from the "2 oz pour" display
    expect(legacy!.offers[0].commerceSource).toBe("MANUAL");
  });

  it("batch records carry Toast commerce provenance onto the offer", () => {
    const batch = ROWS.find((r) => r.offers[0].toastItemGuid != null);
    // Not all batch records have a Toast GUID yet, so only assert if one exists.
    if (batch) {
      expect(batch.offers[0].commerceSource).toBe("TOAST");
      expect(batch.offers[0].priceUsd).not.toBeNull();
    }
  });
});

describe("guestRecordToRows — review data-boundary fixes", () => {
  it("keeps the category inventory additions hidden as unverified drafts", () => {
    const draftInventory = ROWS.filter(
      (r) => r.venueSpirit.notes === "Draft inventory setup. Do not publish until source review is complete.",
    );

    expect(draftInventory).toHaveLength(90);
    expect(draftInventory.every((r) => r.venueSpirit.recordStatus === "DRAFT")).toBe(true);
    expect(draftInventory.every((r) => r.venueSpirit.publicationStatus === "DRAFT")).toBe(true);
    expect(draftInventory.every((r) => r.definition.verificationStatus === "UNSOURCED")).toBe(true);

    const slugs = new Set(draftInventory.map((r) => r.definition.slug));
    expect(slugs).toContain("milagro-silver");
    expect(slugs).toContain("milagro-reposado");
    expect(slugs).toContain("zumbador-blanco");
    expect(slugs).toContain("zumbador-anejo");
    expect(slugs).toContain("zumbador-reposado");
    expect(slugs).toContain("ketle-vodka");
    expect(slugs).toContain("vodka-grey-whale");
  });

  it("never imports the bourbon silhouette (silo stays null until the mapper exists)", () => {
    for (const { definition } of ROWS) {
      expect(definition.silo).toBeNull();
    }
    // In particular, non-bourbon categories are not bourbon-siloed.
    const nonBourbon = ROWS.filter((r) => r.definition.category !== "Bourbon");
    expect(nonBourbon.length).toBeGreaterThan(0);
    for (const { definition } of nonBourbon) {
      expect(definition.silo).not.toBe("bourbon");
    }
  });

  it("maps verification labels to the real distribution (56 SOURCED / 49 PARTIALLY / 95 UNSOURCED)", () => {
    const counts = { SOURCED: 0, PARTIALLY_SOURCED: 0, UNSOURCED: 0 } as Record<string, number>;
    for (const { definition } of ROWS) counts[definition.verificationStatus]++;
    expect(counts).toEqual({ SOURCED: 56, PARTIALLY_SOURCED: 49, UNSOURCED: 95 });
  });

  it("retains the source's own provenance, appends the 1.5oz correction, and never mislabels a manual price as Toast", () => {
    let toast = 0;
    let manual = 0;
    for (const { offers } of ROWS) {
      for (const o of offers) {
        expect(o.pourSizeOz).toBe(ECHO_TOAST_POUR_OZ);
        expect(o.priceProvenance).toContain("1.5 oz"); // the appended correction
        if (o.commerceSource === "TOAST") {
          toast++;
          // original Toast provenance is retained
          expect(o.priceProvenance).toContain("Toast POS menu");
        } else {
          manual++;
          // a manual/legacy price must never claim a Toast source
          expect(o.priceProvenance).not.toContain("Toast POS menu");
        }
      }
    }
    expect(toast).toBe(173); // real vault: 90 reviewed Toast offers + 83 draft Toast offers
    expect(manual).toBe(27); // 15 Sean + 5 legacy + 7 website-only draft offers
  });

  it("puts the dossier review date on shared knowledge, not the venue listing", () => {
    for (const { definition, venueSpirit } of ROWS) {
      expect(venueSpirit.reviewedAt).toBeNull();
    }
    // Every source record carries reviewedAt, so every definition gets it.
    const withKnowledgeReview = ROWS.filter((r) => r.definition.knowledgeReviewedAt != null);
    expect(withKnowledgeReview.length).toBe(110);
  });
});

describe("guestRecordToRows — legacy/batch data-loss fixes (Codex review)", () => {
  const bySlug = (s: string) => ROWS.find((r) => r.definition.slug === s)!;

  it("splits legacy identity into brand + expression (not the whole name as brand)", () => {
    const p = bySlug("penelope-barrel-strength").definition;
    expect(p.brand).toBe("Penelope");
    expect(p.expression).toBe("Barrel Strength");
    expect(bySlug("don-fulano-blanco-fuerte").definition.brand).toBe("Don Fulano");
    expect(bySlug("macallan-12-double-cask").definition.expression).toBe("12 Double Cask");
  });

  it("recovers structured location for legacy records from dist.place", () => {
    const p = bySlug("penelope-barrel-strength").definition;
    expect(p.city).toBe("Lawrenceburg");
    expect(p.region).toBe("Indiana");
    expect(p.country).toBe("USA");
  });

  it("retains producer/owner for batch records, and leaves legacy producer null", () => {
    // makeBatchSpirit folds producer into distilleryName; recovered from _config.
    const withProducer = ROWS.filter((r) => r.definition.producerName != null);
    expect(withProducer.length).toBeGreaterThan(0);
    expect(bySlug("penelope-barrel-strength").definition.producerName).toBeNull();
  });

  it("derives the unaged flag from legacy age text", () => {
    expect(bySlug("don-fulano-blanco-fuerte").definition.unaged).toBe(true);
  });
});
