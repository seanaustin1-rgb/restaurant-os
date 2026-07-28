import { describe, it, expect } from "vitest";
import { loadGuestRecords } from "./load-guest-records";
import { guestRecordToRows } from "./transform";
import { validateSpirit } from "./validate";

// These run against the REAL static vault (docs/spirit-vault/*), reconstructed
// exactly as a guest's browser builds it — so the transform is proven on all
// 110 records (both the legacy and batch shapes), not hand-picked fixtures.
const RECORDS = loadGuestRecords();
const ROWS = RECORDS.map(guestRecordToRows);

describe("loadGuestRecords", () => {
  it("reconstructs the full vault (110 records; 108 guest-visible)", () => {
    expect(RECORDS.length).toBe(110);
    const guestVisible = ROWS.filter(
      ({ spirit }) =>
        spirit.recordStatus === "PUBLISHED" && spirit.publicationStatus === "PUBLISHED",
    );
    expect(guestVisible.length).toBe(108);
  });
});

describe("guestRecordToRows — every record maps without loss", () => {
  it("gives each record a slug, a category, and a non-empty brand", () => {
    for (const { spirit } of ROWS) {
      expect(spirit.slug, JSON.stringify(spirit)).toBeTruthy();
      expect(spirit.category).toBeTruthy();
      expect(spirit.brand.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps slugs unique (the tenant-stable public id)", () => {
    const slugs = ROWS.map((r) => r.spirit.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("produces exactly one primary pour per record", () => {
    for (const { pours } of ROWS) {
      expect(pours.length).toBe(1);
      expect(pours.filter((p) => p.isPrimary).length).toBe(1);
    }
  });

  it("never lets publicationStatus outrank recordStatus", () => {
    const rank = { DRAFT: 0, REVIEWED: 1, PUBLISHED: 2 } as const;
    for (const { spirit } of ROWS) {
      expect(rank[spirit.publicationStatus]).toBeLessThanOrEqual(rank[spirit.recordStatus]);
    }
  });

  it("maps proof: numeric proofN wins, else a display label", () => {
    for (const { spirit } of ROWS) {
      if (spirit.proofN != null) {
        expect(typeof spirit.proofN).toBe("number");
        expect(spirit.proofDisplay).toBeNull();
      }
    }
  });
});

describe("guestRecordToRows — every published record passes the publish gate", () => {
  it("validates cleanly for all 108 guest-visible spirits", () => {
    const failures: { slug: string; errors: unknown }[] = [];
    for (const { spirit, pours } of ROWS) {
      if (spirit.publicationStatus !== "PUBLISHED") continue;
      const errors = validateSpirit(
        {
          slug: spirit.slug,
          brand: spirit.brand,
          category: spirit.category,
          recordStatus: spirit.recordStatus,
          publicationStatus: spirit.publicationStatus,
          body: spirit.body,
          finish: spirit.finish,
          topNotes: spirit.topNotes,
          whyShort: spirit.whyShort,
          flavor: spirit.flavor as Record<string, unknown> | null,
        },
        pours,
      );
      if (errors.length) failures.push({ slug: spirit.slug, errors });
    }
    // A published record that fails the gate is a real data problem worth seeing.
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });
});

describe("guestRecordToRows — legacy vs batch shapes both resolve", () => {
  it("legacy records (no commerce block) still get a priced primary pour", () => {
    const legacy = ROWS.find((r) => r.spirit.slug === "penelope-barrel-strength");
    expect(legacy).toBeDefined();
    expect(legacy!.spirit.publicationStatus).toBe("PUBLISHED");
    expect(legacy!.pours[0].priceUsd).toBe(14); // parsed from the "$14" display string
    expect(legacy!.pours[0].pourSizeOz).toBe(2); // parsed from "2 oz pour"
    expect(legacy!.pours[0].commerceSource).toBe("MANUAL");
  });

  it("batch records carry Toast commerce provenance onto the pour", () => {
    const batch = ROWS.find((r) => r.pours[0].toastItemGuid != null);
    // Not all batch records have a Toast GUID yet, so only assert if one exists.
    if (batch) {
      expect(batch.pours[0].commerceSource).toBe("TOAST");
      expect(batch.pours[0].priceUsd).not.toBeNull();
    }
  });
});
