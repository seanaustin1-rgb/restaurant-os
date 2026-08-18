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

/** Tier C in DRAFT-CONTENT-AUDIT.md — house / generic flavored pours. Sean decided
 *  on 2026-08-18 that these are SHELF-ONLY: listed so the shelf reads complete, no
 *  guest dossier, ever. The risk this list guards is the opposite of the sourced
 *  drafts' — not that they publish early, but that some later pass quietly starts
 *  writing producer facts for a well pour that has no single producer. */
const SHELF_ONLY_IDS = [
  "house-vodka",
  "strawberry-vodka",
  "raspberry-vodka",
  "vodka-blueberry",
  "vodka-peach",
  "vodka-caramel",
  "vodka-orange",
  "whipped-vodka",
];

/** Identity confirmed by Sean at the shelf on 2026-08-18 (audit questions 2/3/5/6).
 *  Each maps id → the subcategory it was re-filed into and the brand now recorded.
 *  Knowing WHICH bottle it is does not source a single fact about it, so every one
 *  of these must still read `unverified`. */
const IDENTITY_CONFIRMED: Record<string, { cat: string; subcategory: string; brand: string }> = {
  "jose-cuervo-tequila": { cat: "Agave", subcategory: "gold-joven", brand: "Jose Cuervo" },
  "herradura-ultra-blanco": { cat: "Agave", subcategory: "anejo-and-specialty", brand: "Herradura" },
  "ketle-vodka": { cat: "Vodka", subcategory: "vodka", brand: "Ketel One" },
  "apostoles-rosa": { cat: "Gin", subcategory: "gin", brand: "Príncipe de los Apóstoles" },
};

/** Still held — Sean could not confirm these at the shelf, so they keep the Toast
 *  catch-all subcategory and no facts. */
const HELD_IDENTITY_IDS = ["maison-ferrand-plantation-moko-dark"];

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

describe("shelf-only listings (Sean, 2026-08-18)", () => {
  it("keeps them listed, unverified and unpublished", () => {
    for (const id of SHELF_ONLY_IDS) {
      const r = byId.get(id);
      expect(r, `${id} must still exist`).toBeTruthy();
      expect(r.verificationStatus, `${id} verificationStatus`).toBe("unverified");
      expect(r.publicationStatus, `${id} publicationStatus`).toBe("draft");
      expect(r.recordStatus, `${id} recordStatus`).toBe("draft");
    }
  });

  it("says shelf-only out loud instead of implying a review that is not coming", () => {
    for (const id of SHELF_ONLY_IDS) {
      const r = byId.get(id);
      const flagged = (r.provenance?.sourcingLimitations ?? []).some((l: string) =>
        l.includes("Shelf listing only"),
      );
      expect(flagged, `${id} must declare itself shelf-only`).toBe(true);
      // The scaffold's "pending source review" language would put it back in a
      // queue Sean has explicitly closed.
      expect(String(r.notes), `${id} notes`).not.toContain("pending source review");
      expect(String(r.why), `${id} why`).not.toContain("pending source review");
    }
  });

  it("claims no producer and no tasting notes for a well pour", () => {
    for (const id of SHELF_ONLY_IDS) {
      const r = byId.get(id);
      // Three placeholder notes would read as "notes coming"; none is the honest state.
      expect(r.topNotes, `${id} topNotes`).toBeFalsy();
      expect(String(r.distillery), `${id} distillery`).toContain("no producer claimed");
      expect(r.provenance?.sources ?? [], `${id} must cite nothing`).toHaveLength(0);
    }
  });
});

describe("no draft-inventory record infers a distillery from its brand", () => {
  // Codex P2 on #146. makeBatchSpirit falls back distilleryName -> producer ->
  // brand, and guestRecordToRows() imports the STRUCTURED fields, not the
  // display string — so an unguarded draft wrote "Milagro" / "Ketel One" /
  // "House" into the DB as a distillery while its own limitations said producer
  // and origin were unsourced. The display string may still say "<brand> -
  // Origin pending"; the structured fields must be null until a producer is cited.
  const draftInventory = RECORDS.filter((r) =>
    ["Draft inventory setup", "Identity confirmed by Sean", "Shelf-only by Sean"].some((p) =>
      String(r.notes ?? "").startsWith(p),
    ),
  );

  it("covers all 64 draft-inventory records", () => {
    expect(draftInventory).toHaveLength(64);
  });

  it("leaves distilleryName and dist.name null on every one of them", () => {
    for (const r of draftInventory) {
      expect(r.distilleryName ?? null, `${r.id} distilleryName`).toBeNull();
      expect(r.dist?.name ?? null, `${r.id} dist.name`).toBeNull();
    }
  });

  it("still gives the engine a non-blank distillery display string", () => {
    // REQUIRED_SPIRIT_FIELDS includes 'distillery'; a blank one fails validation.
    for (const r of draftInventory) {
      expect(String(r.distillery ?? "").trim(), `${r.id} distillery display`).not.toBe("");
    }
  });
});

describe("identity confirmed but facts still unsourced (Sean, 2026-08-18)", () => {
  it("records the confirmed brand and re-files the record", () => {
    for (const [id, expected] of Object.entries(IDENTITY_CONFIRMED)) {
      const r = byId.get(id);
      expect(r, `${id} must still exist`).toBeTruthy();
      expect(r.cat, `${id} cat`).toBe(expected.cat);
      expect(r.subcategory, `${id} subcategory`).toBe(expected.subcategory);
      expect(r.brand, `${id} brand`).toBe(expected.brand);
      // The venue shelf label is deliberately preserved as the display name.
      expect(String(r.name || ""), `${id} displayName`).not.toBe("");
    }
  });

  it("never lets an identity confirmation masquerade as a sourced fact", () => {
    for (const id of Object.keys(IDENTITY_CONFIRMED)) {
      const r = byId.get(id);
      expect(r.verificationStatus, `${id} verificationStatus`).toBe("unverified");
      expect(r.publicationStatus, `${id} publicationStatus`).toBe("draft");
      expect(r.provenance?.sources ?? [], `${id} must cite no producer source`).toHaveLength(0);
      const flagged = (r.provenance?.sourcingLimitations ?? []).some((l: string) =>
        l.includes("an identity confirmation is not a source"),
      );
      expect(flagged, `${id} must flag identity-only sourcing`).toBe(true);
    }
  });

  it("keeps the scaffold radar from reading as a tasting profile", () => {
    for (const id of [...Object.keys(IDENTITY_CONFIRMED), ...SHELF_ONLY_IDS]) {
      const r = byId.get(id);
      const flagged = (r.provenance?.sourcingLimitations ?? []).some((l: string) =>
        l.includes("inert scaffold defaults"),
      );
      expect(flagged, `${id} must flag its radar as scaffold filler`).toBe(true);
    }
  });
});

describe("records Sean has not cleared stay untouched", () => {
  it("leaves the unresolved identity holds parked in their draft subcategory", () => {
    for (const id of HELD_IDENTITY_IDS) {
      const r = byId.get(id);
      expect(r, `${id} must still exist`).toBeTruthy();
      expect(r.verificationStatus, `${id} verificationStatus`).toBe("unverified");
      expect(r.publicationStatus, `${id} publicationStatus`).toBe("draft");
      expect(r.provenance?.sources ?? [], `${id} must cite nothing`).toHaveLength(0);
    }
  });
});
