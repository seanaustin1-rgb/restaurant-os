import { describe, it, expect } from "vitest";
import { loadGuestRecords } from "./load-guest-records";
import { guestRecordToRows } from "./transform";
import { FLAVOR_AXES, validatePublishableSpirit } from "./validate";

// Batch 2 and Batch 3 — the agave / rum / vodka records whose product facts and
// tasting profiles have been source-reviewed but which are NOT approved for
// publication.
//
// The point of this file is to make the two failure modes we actually care about
// impossible to land silently:
//   1. a sourced draft quietly becoming guest-visible without Sean approving it,
//   2. "sourced" content that is really invented — no citations, no limitations,
//      a fabricated tasting profile, or venue voice written on Sean's behalf.

const RECORDS = loadGuestRecords() as any[];
const byId = new Map(RECORDS.map((r) => [String(r.id), r]));

/** Frozen: exactly these 26 records were promoted in this pass. Adding one is a
 *  deliberate act and should require editing this list. */
const SOURCED_DRAFT_IDS = [
  // agave
  "herradura-silver",
  "herradura-reposado",
  "herradura-anejo",
  "el-jimador-silver",
  "el-jimador-reposado",
  "el-jimador-anejo",
  "casa-amigos-80pf",
  "casamigos-reposado",
  "casamigos-anejo",
  "patron-silver",
  "don-fulano-reposado",
  "don-fulano-anejo",
  // rum
  "bacardi-white",
  "captain-morgan-original-spiced",
  "malibu",
  "gosling-s-black-seal",
  "myers-s-dark",
  "don-q-151",
  "zaya-gran-reserva-16-year",
  "diplomatico-mantuano-dark",
  // vodka
  "absolut-vodka",
  "grey-goose-vodka",
  "tito-s-vodka",
  "belvidere-vodka",
  "chopin-potato-vodka",
  "haku-vodka",

  // ── Batch 3 (2026-09-04) — the rest of Tier A from DRAFT-CONTENT-AUDIT.md ──
  // agave
  "el-jimador-cristalino",
  "el-luchador-blanco",
  "mi-campo-blanco",
  "milagro-silver",
  "tres-agaves-organic-blanco",
  "1800-silver",
  "adictivo-reposado",
  "agavales-reposado",
  "el-luchador-reposado",
  "jose-1800-reposado",
  "mi-campo-reposado",
  "milagro-reposado",
  "terralta-reposado",
  "1800-anejo-tequila",
  "21-seeds-cucumber-jalapeno",
  "123-organic-anejo",
  // rum
  "angostura-white-oak",
  "bacardi-dragonberry",
  "captain-morgan-private-stock",
  "bumbu-dark",
  "kasama-small-batch-7-year",
  "papa-s-pilar-blonde",
  "don-q-2x-aged-cognac-cask",
  "don-q-gran-reserva-anejo-xo",
  "ron-batran-12-reserva-superior",
  "ron-barcelo-imperial",
  "planteray-3-star",
  // vodka
  "stoli-vodka",
  "double-cross-vodka",
  "boyd-bair-potato-vodka",
  "vodka-grey-whale",
];

/** The importer already knows these slugs under their original (wrong-looking)
 *  spelling. Renaming them would insert duplicates instead of updating in place. */
const PRESERVED_IMPORT_SLUGS = [
  "casa-amigos-80pf",
  "belvidere-vodka",
  "jose-1800-reposado",
  "boyd-bair-potato-vodka",
  "ron-batran-12-reserva-superior",
];

/** Tier C in DRAFT-CONTENT-AUDIT.md — house / generic flavored pours. Sean has not
 *  decided whether these get dossiers at all, so they must stay untouched. */
const HELD_HOUSE_VODKA_IDS = [
  "house-vodka",
  "strawberry-vodka",
  "raspberry-vodka",
  "vodka-blueberry",
  "vodka-peach",
  "vodka-caramel",
  "vodka-orange",
  "whipped-vodka",
];

/** Known identity holds — must not have been given content or a real subcategory. */
const HELD_IDENTITY_IDS = ["jose-cuervo-tequila", "apostoles-rosa"];

const PLACEHOLDER_NOTE = "Pending source review";
const PENDING_SEAN = "Pending Sean review.";

const sourced = RECORDS.filter(
  (r) => r.verificationStatus === "source-reviewed" && r.recordStatus === "draft",
);

describe("spirit vault corpus is unchanged in shape", () => {
  it("still holds 200 records with unique slugs", () => {
    expect(RECORDS.length).toBe(200);
    expect(new Set(RECORDS.map((r) => String(r.id))).size).toBe(200);
  });
});

describe("Batch 2 sourced drafts", () => {
  it("promotes exactly the recorded ids", () => {
    expect(sourced.map((r) => String(r.id)).sort()).toEqual([...SOURCED_DRAFT_IDS].sort());
  });

  it("keeps every one of them hidden from guests", () => {
    for (const r of sourced) {
      expect(r.recordStatus, `${r.id} recordStatus`).toBe("draft");
      expect(r.publicationStatus, `${r.id} publicationStatus`).toBe("draft");
    }
  });

  it("keeps the two preserved import slugs so an apply updates in place", () => {
    for (const slug of PRESERVED_IMPORT_SLUGS) {
      expect(byId.has(slug), `${slug} must still exist`).toBe(true);
      expect(String(byId.get(slug).verificationStatus)).toBe("source-reviewed");
    }
  });

  it("cites at least one source and records its limitations", () => {
    for (const r of sourced) {
      expect(r.provenance?.sources?.length, `${r.id} sources`).toBeGreaterThan(0);
      for (const s of r.provenance.sources) {
        expect(String(s.url), `${r.id} source url`).toMatch(/^https:\/\//);
      }
      expect(r.provenance?.sourcingLimitations?.length, `${r.id} limitations`).toBeGreaterThan(0);
    }
  });

  // The radar used to be an explicit unsourced placeholder and every record had to
  // say so. It is now built from published tasting sources, so the inverse holds:
  // a complete radar, and no leftover caveat claiming otherwise.
  it("carries a complete flavor radar on all seven axes", () => {
    for (const r of sourced) {
      for (const axis of FLAVOR_AXES) {
        const v = r.flavor?.[axis];
        expect(
          Number.isInteger(v) && v >= 0 && v <= 10,
          `${r.id} flavor.${axis} must be an integer 0–10, got ${v}`,
        ).toBe(true);
      }
      for (const k of ["body", "finish"] as const) {
        expect(Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 10, `${r.id} ${k}`).toBe(true);
      }
      const stale = r.provenance.sourcingLimitations.some((l: string) => l.includes("Flavor radar"));
      expect(stale, `${r.id} still carries the old unsourced-radar caveat`).toBe(false);
    }
  });

  // Sean's instruction: the dossier reads with authority. Hedging vocabulary must
  // not reach guest-facing copy.
  it("keeps hedging language out of guest-facing copy", () => {
    const HEDGE = /\b(derived|not tasted|placeholder)\b/i;
    for (const r of sourced) {
      expect(HEDGE.test(String(r.why)), `${r.id} why`).toBe(false);
      expect(HEDGE.test(String(r.whyShort)), `${r.id} whyShort`).toBe(false);
      for (const n of r.topNotes ?? []) expect(HEDGE.test(n), `${r.id} topNote "${n}"`).toBe(false);
    }
  });

  it("leaves venue voice to Sean", () => {
    for (const r of sourced) {
      expect(r.whyWeCarry, `${r.id} whyWeCarry`).toBe(PENDING_SEAN);
      expect(r.seanShort, `${r.id} seanShort`).toBe(PENDING_SEAN);
      expect(String(r.notes), `${r.id} notes`).toContain("pending Sean review");
    }
  });

  it("carries real identity and a real sourced summary", () => {
    for (const r of sourced) {
      expect(String(r.brand || ""), `${r.id} brand`).not.toBe("");
      expect(String(r.country || ""), `${r.id} country`).not.toBe("");
      expect(String(r.dist?.name || ""), `${r.id} distillery`).not.toBe("");
      // makeBatchSpirit's fallbacks mean "unwritten" content, not sourced content.
      expect(String(r.whyShort), `${r.id} whyShort`).not.toContain("pending Sean review");
      expect(String(r.dist?.history), `${r.id} history`).not.toContain("pending Sean review");
      expect(r.production?.length, `${r.id} production rows`).toBeGreaterThan(0);
    }
  });

  it("carries exactly three real tasting notes, none of them placeholders", () => {
    for (const r of sourced) {
      const notes: string[] = r.topNotes ?? [];
      expect(notes.length, `${r.id} topNotes`).toBe(3);
      for (const n of notes) {
        expect(n, `${r.id} topNote`).not.toBe(PLACEHOLDER_NOTE);
        expect(String(n).trim().length, `${r.id} empty topNote`).toBeGreaterThan(0);
      }
    }
  });

  // The point of the whole exercise: these are one Sean approval away from live.
  // Anything that would still fail the gate should fail for a reason he can act on,
  // not because the dossier is unfinished.
  it("would pass the publish gate on content, leaving only commerce gaps", () => {
    const contentFailures: string[] = [];
    for (const r of sourced) {
      const { definition, venueSpirit, offers } = guestRecordToRows(r);
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
        venueSpirit: { slug: venueSpirit.slug, recordStatus: "PUBLISHED", publicationStatus: "PUBLISHED" },
        offers: offers.map((o) => ({ pourSizeOz: o.pourSizeOz, priceUsd: o.priceUsd, isPrimary: o.isPrimary })),
      });
      // A missing price is a POS/menu gap, not a content gap — four shelf-only
      // bottles have no Toast match. Any OTHER failure is ours and must not land.
      const nonCommerce = errors.filter((e) => e.field !== "offers");
      if (nonCommerce.length) contentFailures.push(`${venueSpirit.slug}: ${JSON.stringify(nonCommerce)}`);
    }
    expect(contentFailures).toEqual([]);
  });
});

describe("records Sean has not cleared stay untouched", () => {
  it("leaves the house / generic flavored vodkas as unverified drafts", () => {
    for (const id of HELD_HOUSE_VODKA_IDS) {
      const r = byId.get(id);
      expect(r, `${id} must still exist`).toBeTruthy();
      expect(r.verificationStatus, `${id} verificationStatus`).toBe("unverified");
      expect(r.publicationStatus, `${id} publicationStatus`).toBe("draft");
    }
  });

  it("leaves the known identity holds parked in the Toast catch-all subcategory", () => {
    for (const id of HELD_IDENTITY_IDS) {
      const r = byId.get(id);
      expect(r, `${id} must still exist`).toBeTruthy();
      expect(r.subcategory, `${id} subcategory`).toBe("toast-agave-draft");
      expect(r.verificationStatus, `${id} verificationStatus`).toBe("unverified");
    }
  });
});
