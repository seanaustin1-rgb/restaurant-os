import { describe, it, expect } from "vitest";
import { loadGuestRecords } from "./load-guest-records";

// Batch 2 — the agave / rum / vodka records whose product facts have been
// source-reviewed but which are NOT approved for publication.
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
];

/** The importer already knows these two slugs under their original (wrong-looking)
 *  spelling. Renaming them would insert duplicates instead of updating in place. */
const PRESERVED_IMPORT_SLUGS = ["casa-amigos-80pf", "belvidere-vodka"];

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
  it("promotes exactly the 26 recorded ids", () => {
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

  it("never presents the flavor radar as sourced", () => {
    for (const r of sourced) {
      const flagged = r.provenance.sourcingLimitations.some((l: string) =>
        l.includes("Flavor radar, body and finish are unsourced placeholders"),
      );
      expect(flagged, `${r.id} must flag its radar as unsourced`).toBe(true);
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

  it("never mixes real tasting notes with placeholders", () => {
    for (const r of sourced) {
      const notes: string[] = r.topNotes ?? [];
      expect(notes.length, `${r.id} topNotes`).toBeGreaterThan(0);
      const placeholders = notes.filter((n) => n === PLACEHOLDER_NOTE).length;
      expect(
        placeholders === 0 || placeholders === notes.length,
        `${r.id} must not pad sourced notes with placeholders`,
      ).toBe(true);
      // A short note list is honest, but it has to say so — the publish gate wants three.
      if (placeholders === 0 && notes.length < 3) {
        const flagged = r.provenance.sourcingLimitations.some((l: string) =>
          l.includes("topNotes is intentionally short"),
        );
        expect(flagged, `${r.id} has ${notes.length} notes and must flag it`).toBe(true);
      }
    }
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
