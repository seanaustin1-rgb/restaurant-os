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
    slots: [{ key: "finished", label: "Cask-finished", rules: { categories: WHISKEY_CATEGORIES, searchTerms: ["port", "sherry", "oloroso", "px", "madeira", "rum", "wine", "toast", "double oak"] }, itemNote: "The finishing cask adds fruit, sweetness, or spice over the base whiskey." }],
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
  {
    key: "agave-terroir",
    name: "Agave Terroir",
    description: "Earth, smoke, and wood across agave spirits.",
    throughLine:
      "This flight traces terroir across agave spirits — how soil, altitude, roasting method, and barrel treatment shape flavor from blanco through añejo and beyond.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [{ key: "agave", label: "Agave spirit", rules: { categories: ["Tequila", "Mezcal", "Agave", "Sotol"] }, itemNote: "Notice how the agave's origin and treatment shape the spirit." }],
  },
  {
    key: "smoke-peat-earth",
    name: "Smoke, Peat & Earth",
    description: "Smoky, peated, and earthy spirits side by side.",
    throughLine:
      "A flight built around smoke, peat, and earth — comparing how different fuel sources, terroir, and production methods create distinct expressions of these flavors.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [{ key: "smoky", label: "Smoky / Peated / Earthy", rules: { searchTerms: ["smoke", "smoked", "smoky", "peat", "peated", "islay", "campfire", "mezcal", "earth"] }, itemNote: "Trace the smoke — is it peat, charcoal, open fire, or roasted agave?" }],
  },
  {
    key: "top-shelf",
    name: "Top Shelf",
    description: "Premium pours for a special occasion.",
    throughLine:
      "A celebration flight of premium pours — longer aged, limited release, or higher proof expressions that reward slow, focused tasting.",
    maxPours: 4,
    autoOrder: "proof-asc",
    slots: [{ key: "premium", label: "Premium pour", rules: { searchTerms: ["reserve", "single barrel", "barrel pick", "barrel select", "limited", "rare", "cask strength", "barrel proof", "aged", "estate", "special"] }, itemNote: "A premium pour — take your time and note the complexity." }],
  },
  {
    key: "gateway",
    name: "Gateway Flight",
    description: "Approachable pours for first-time explorers.",
    throughLine:
      "An introductory flight designed for guests who are new to sipping spirits — approachable proofs, familiar flavors, and a gentle progression that builds comfort and curiosity.",
    maxPours: 4,
    autoOrder: "proof-asc",
    slots: [{ key: "intro", label: "80–95 proof", rules: { proofMin: 80, proofMax: 95 }, itemNote: "An approachable entry — notice the sweetness and texture before the finish." }],
  },
  {
    key: "scotch-world",
    name: "Scotch & World Whiskey",
    description: "Single malts, blends, and world whiskeys compared.",
    throughLine:
      "A journey beyond American whiskey — comparing Scotch, Irish, Japanese, and other world whiskeys to reveal how geography, grain, and tradition shape flavor.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [{ key: "world", label: "Scotch / World Whiskey", rules: { categories: ["Scotch", "Irish", "Japanese", "Canadian", "World Whisky", "World Whiskey", "Single Malt"] }, itemNote: "Compare the regional character — climate, water, grain, and cask tradition." }],
  },
  {
    key: "single-barrel",
    name: "Single Barrel Selections",
    description: "Barrel picks and single barrel expressions.",
    throughLine:
      "Every barrel ages differently. This flight compares single barrel selections — each chosen for its individual character — showing how the same distillery can produce distinct flavors barrel to barrel.",
    maxPours: 4,
    autoOrder: "proof-asc",
    slots: [{ key: "barrel", label: "Single barrel / Barrel pick", rules: { searchTerms: ["single barrel", "barrel pick", "barrel select", "barrel proof", "store pick", "private select", "private barrel"] }, itemNote: "A barrel selection — notice what makes this barrel unique." }],
  },
  {
    key: "mash-bill",
    name: "Mash Bill Comparison",
    description: "How grain recipes shape flavor.",
    throughLine:
      "This flight compares how different grain recipes — corn-forward, high-rye, wheated, and four-grain — shape sweetness, spice, body, and finish in American whiskey.",
    maxPours: 4,
    autoOrder: "slot-order",
    slots: [
      { key: "corn", label: "Corn-forward / Traditional", rules: { categories: ["Bourbon"], searchTerms: ["corn", "traditional", "low rye"] }, itemNote: "Corn-forward sweetness — the baseline mash bill." },
      { key: "high-rye", label: "High-rye", rules: { categories: ["Bourbon", "Rye"], searchTerms: ["high rye", "rye"] }, itemNote: "Higher rye content adds spice and structure." },
      { key: "wheat", label: "Wheated", rules: { categories: ["Bourbon"], searchTerms: ["wheat", "wheated"] }, itemNote: "Wheat softens the profile — notice the rounder, gentler finish." },
    ],
  },
];

export function flightTemplateByKey(key: string): FlightTemplate | undefined {
  return FLIGHT_TEMPLATES.find((t) => t.key === key);
}
