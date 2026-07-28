import { describe, it, expect } from "vitest";
import { loadGuestRecords } from "./load-guest-records";
import { guestRecordToRows } from "./transform";
import { validatePublishableSpirit } from "./validate";

// Integration cross-check: the transform and the publish validator must agree on
// the REAL vault. Every guest-visible record, once mapped to the split rows,
// must pass the composed-unit publish gate — otherwise the import would stage a
// "published" listing the gate would reject. This ties the two modules the
// parallel rewrite produced back together against live data.
const ROWS = loadGuestRecords().map(guestRecordToRows);

describe("import parity — transform output satisfies the publish validator", () => {
  it("maps 108 guest-visible records", () => {
    const visible = ROWS.filter(
      ({ venueSpirit }) =>
        venueSpirit.recordStatus === "PUBLISHED" &&
        venueSpirit.publicationStatus === "PUBLISHED",
    );
    expect(visible.length).toBe(108);
  });

  it("every published record passes validatePublishableSpirit", () => {
    const failures: { slug: string; errors: unknown }[] = [];
    for (const { definition, venueSpirit, offers } of ROWS) {
      if (venueSpirit.publicationStatus !== "PUBLISHED") continue;
      const errors = validatePublishableSpirit({
        definition: {
          slug: definition.slug,
          brand: definition.brand,
          category: definition.category,
          body: definition.body,
          finish: definition.finish,
          topNotes: definition.topNotes,
          whyShort: definition.whyShort,
          flavor: definition.flavor as Record<string, unknown> | null,
        },
        venueSpirit: {
          slug: venueSpirit.slug,
          recordStatus: venueSpirit.recordStatus,
          publicationStatus: venueSpirit.publicationStatus,
        },
        offers: offers.map((o) => ({
          pourSizeOz: o.pourSizeOz,
          priceUsd: o.priceUsd,
          isPrimary: o.isPrimary,
        })),
      });
      if (errors.length) failures.push({ slug: venueSpirit.slug, errors });
    }
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });

  it("keeps definition and venue slugs 1:1 for the single-venue import", () => {
    // During Echo-only testing every definition has exactly one venue listing,
    // so the two slug sets match. (Multi-venue imports will diverge later.)
    const defSlugs = new Set(ROWS.map((r) => r.definition.slug));
    const venueSlugs = new Set(ROWS.map((r) => r.venueSpirit.slug));
    expect(defSlugs.size).toBe(ROWS.length);
    expect(venueSlugs.size).toBe(ROWS.length);
  });
});
