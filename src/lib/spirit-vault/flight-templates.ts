// Static, code-defined flight templates for the ASAP Flight Builder (see
// docs/spirit-vault/FLIGHT-BUILDER-ASAP-BUILD-PLAN.md). This file is the shared
// CONTRACT: Claude owns the registry + types (template content), Codex builds the
// tenant-scoped candidate resolver (flight-template-candidates.ts) against these
// types. Templates never encode tenancy — candidate queries are restaurantId-scoped
// by the resolver. No DB-managed template editor yet.

export type FlightTemplateRules = {
  proofMin?: number;
  proofMax?: number;
  categories?: string[];
  /** Case-insensitive substrings matched against name/style/production text. */
  searchTerms?: string[];
  requiresBottledInBond?: boolean;
  /** Slot needs a venue-voice field (whyWeCarry / seanShort / notes) present. */
  requiresVenueVoice?: boolean;
};

export type FlightTemplateSlot = {
  key: string;
  label: string;
  rules: FlightTemplateRules;
  /** Preset "what to notice" note applied to the flight item chosen for this slot. */
  itemNote: string;
};

export type FlightTemplate = {
  key: string;
  name: string;
  /** One-line description for the picker card. */
  description: string;
  /** Narrative preset into the flight's guest-facing description; staff can edit. */
  throughLine: string;
  maxPours: 4;
  /** Candidate structure: multiple slots = a guided progression; one slot = a flat pool. */
  slots: FlightTemplateSlot[];
  autoOrder: "slot-order" | "proof-asc" | "proof-desc";
  /** In the launch set surfaced first. */
  launch?: boolean;
};

const WHISKEY_CATEGORIES = ["Bourbon", "Rye", "American Whiskey", "Tennessee", "Scotch", "Blended", "Whiskey"];

export const FLIGHT_TEMPLATES: FlightTemplate[] = [
  {
    key: "proof-ascender",
    name: "Proof Ascender",
    description: "A proof ladder, light to barrel-strength.",
    throughLine:
      "This proof ladder steps up concentration gradually, showing how alcohol density changes aroma, texture, finish, and flavor intensity without rushing the palate.",
    maxPours: 4,
    autoOrder: "slot-order",
    launch: true,
    slots: [
      { key: "entry", label: "80–92 proof", rules: { proofMin: 80, proofMax: 92 }, itemNote: "Light entry point — set the baseline before intensity climbs." },
      { key: "core", label: "93–100 proof", rules: { proofMin: 93, proofMax: 100 }, itemNote: "Balanced core / Bottled-in-Bond range — notice the added weight." },
      { key: "dense", label: "105–115 proof", rules: { proofMin: 105, proofMax: 115 }, itemNote: "Denser oils and heavier texture — a drop of water opens it up." },
      { key: "barrel", label: "116+ proof", rules: { proofMin: 116 }, itemNote: "Barrel-proof / uncut intensity — the fullest expression." },
    ],
  },
  {
    key: "high-proof",
    name: "High Proof",
    description: "Concentration, texture, and heat across barrel-strength pours.",
    throughLine:
      "A proof-driven flight built around concentration, texture, heat management, and finish length across stronger pours.",
    maxPours: 4,
    autoOrder: "proof-asc",
    launch: true,
    slots: [{ key: "pool", label: "100+ proof", rules: { proofMin: 100 }, itemNote: "Manage the heat — let each rest, and note how the finish lengthens." }],
  },
  {
    key: "bottled-in-bond",
    name: "Bottled-in-Bond Heritage",
    description: "One distillery, one season, four years, exactly 100 proof.",
    throughLine:
      "The 1897 Bottled-in-Bond standard creates a controlled comparison: one distillery, one season, at least four years old, bottled at exactly 100 proof.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [{ key: "bib", label: "Bottled-in-Bond", rules: { proofMin: 100, proofMax: 100, requiresBottledInBond: true, searchTerms: ["bottled-in-bond", "bottled in bond", "bib"] }, itemNote: "A bonded pour — compare distillery character at a fixed 100 proof." }],
  },
  {
    key: "finished-whiskey",
    name: "Finished Whiskey",
    description: "How a secondary barrel reshapes a whiskey.",
    throughLine:
      "This flight follows how secondary barrels add fruit, sweetness, spice, smoke, or darker texture after primary maturation.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [{ key: "finished", label: "Cask-finished", rules: { categories: WHISKEY_CATEGORIES, searchTerms: ["port", "sherry", "oloroso", "px", "madeira", "rum", "wine", "toast", "double oak"] }, itemNote: "Name the finishing cask — track what it added over the base whiskey." }],
  },
  {
    key: "rye-progression",
    name: "Rye Progression",
    description: "Spice, herbal lift, and structure across ryes.",
    throughLine:
      "A rye-focused progression showing how spice, herbal lift, proof, and oak structure change across rye styles.",
    maxPours: 4,
    autoOrder: "proof-asc",
    slots: [{ key: "rye", label: "Rye", rules: { categories: ["Rye"], searchTerms: ["rye"] }, itemNote: "Trace the spice and herbal lift as proof and oak build." }],
  },
  {
    key: "house-favorites",
    name: "House Favorites",
    description: "Bottles the team is proud to pour.",
    throughLine:
      "A house-curated flight built from bottles the team is proud to recommend, balancing approachability, story, and distinctive flavor.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [{ key: "favorites", label: "Staff pick", rules: { requiresVenueVoice: true }, itemNote: "A house favorite — lead with the story of why we carry it." }],
  },
];

export function flightTemplateByKey(key: string): FlightTemplate | undefined {
  return FLIGHT_TEMPLATES.find((t) => t.key === key);
}
