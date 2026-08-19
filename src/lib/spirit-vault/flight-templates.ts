export type FlightTemplateKey =
  | "proof-ascender"
  | "high-proof"
  | "bottled-in-bond"
  | "finished-whiskey"
  | "rye-progression"
  | "agave-compare";

export type FlightTemplateSort = "proof-asc" | "proof-desc" | "name-asc";

export interface FlightTemplateRules {
  categories?: string[];
  proofMin?: number;
  proofMax?: number;
  textAny?: string[];
  bottledInBond?: boolean;
}

export interface FlightTemplateSlot {
  key: string;
  label: string;
  itemNote: string;
  rules: FlightTemplateRules;
}

export interface FlightTemplate {
  key: FlightTemplateKey;
  label: string;
  description: string;
  throughLine: string;
  minPours: number;
  maxPours: number;
  sort: FlightTemplateSort;
  slots: FlightTemplateSlot[];
}

export interface FlightTemplateMatchable {
  name: string;
  category?: string | null;
  subcategory?: string | null;
  style?: string | null;
  proofN?: number | null;
  proofDisplay?: string | null;
  productionText?: string | null;
  tags?: string[];
}

export const FLIGHT_TEMPLATES: readonly FlightTemplate[] = [
  {
    key: "proof-ascender",
    label: "Proof ascender",
    description: "A structured climb from approachable proof into cask-strength intensity.",
    throughLine:
      "Each pour steps up in proof, showing how texture, heat, oak, and concentration change as the whiskey gets stronger.",
    minPours: 3,
    maxPours: 4,
    sort: "proof-asc",
    slots: [
      {
        key: "approachable",
        label: "80-92 proof",
        itemNote: "Baseline proof and approachable texture.",
        rules: { proofMin: 80, proofMax: 92.99 },
      },
      {
        key: "classic",
        label: "93-100 proof",
        itemNote: "Classic cocktail-to-sipping strength.",
        rules: { proofMin: 93, proofMax: 100.99 },
      },
      {
        key: "full-bodied",
        label: "101-115 proof",
        itemNote: "Higher concentration with more structure.",
        rules: { proofMin: 101, proofMax: 115.99 },
      },
      {
        key: "barrel-strength",
        label: "116+ proof",
        itemNote: "Cask-strength finish and intensity.",
        rules: { proofMin: 116 },
      },
    ],
  },
  {
    key: "high-proof",
    label: "High proof",
    description: "A focused set of higher-proof bottles for guests who want more intensity.",
    throughLine:
      "These pours share elevated proof, but the contrast is in how each spirit carries heat, sweetness, spice, and finish.",
    minPours: 2,
    maxPours: 4,
    sort: "proof-asc",
    slots: [
      {
        key: "high-proof",
        label: "100+ proof",
        itemNote: "High-proof expression.",
        rules: { proofMin: 100 },
      },
    ],
  },
  {
    key: "bottled-in-bond",
    label: "Bottled in bond",
    description: "A 100-proof comparison built around bonded American whiskey.",
    throughLine:
      "Bottled-in-bond gives the flight a consistent proof and production standard, so the differences come from grain, distillery, age, and barrel character.",
    minPours: 2,
    maxPours: 4,
    sort: "name-asc",
    slots: [
      {
        key: "bonded",
        label: "Bonded whiskey",
        itemNote: "Bottled-in-bond benchmark.",
        rules: { bottledInBond: true },
      },
    ],
  },
  {
    key: "finished-whiskey",
    label: "Finished whiskey",
    description: "A comparison of secondary cask influence across finished whiskeys.",
    throughLine:
      "The line through the flight is cask finishing: each pour starts as whiskey, then picks up a second layer from wine, rum, port, sherry, or another finishing barrel.",
    minPours: 2,
    maxPours: 4,
    sort: "name-asc",
    slots: [
      {
        key: "finished",
        label: "Finished or secondary cask",
        itemNote: "Secondary cask influence.",
        rules: { textAny: ["finish", "finished", "port", "sherry", "rum cask", "wine cask", "mizunara"] },
      },
    ],
  },
  {
    key: "rye-progression",
    label: "Rye progression",
    description: "A spicy rye-focused build across proof, mash, or production style.",
    throughLine:
      "Each pour centers rye spice, then separates itself through proof, barrel style, age, or the balance between baking spice and herbal grain character.",
    minPours: 2,
    maxPours: 4,
    sort: "proof-asc",
    slots: [
      {
        key: "rye",
        label: "Rye whiskey",
        itemNote: "Rye spice expression.",
        rules: { categories: ["Rye"], textAny: ["rye"] },
      },
    ],
  },
  {
    key: "agave-compare",
    label: "Agave compare",
    description: "A tequila or mezcal comparison by style, age, or production character.",
    throughLine:
      "The common thread is agave, with each pour showing a different expression of roast, minerality, barrel influence, or freshness.",
    minPours: 2,
    maxPours: 4,
    sort: "name-asc",
    slots: [
      {
        key: "agave",
        label: "Agave spirits",
        itemNote: "Agave expression.",
        rules: { categories: ["Tequila", "Mezcal", "Agave"], textAny: ["agave", "tequila", "mezcal"] },
      },
    ],
  },
] as const;

export function listFlightTemplates(): readonly FlightTemplate[] {
  return FLIGHT_TEMPLATES;
}

export function getFlightTemplate(key: FlightTemplateKey): FlightTemplate {
  const template = FLIGHT_TEMPLATES.find((item) => item.key === key);
  if (!template) throw new Error(`Unknown flight template: ${key}`);
  return template;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function includesAny(haystack: string, terms: readonly string[]): boolean {
  return terms.some((term) => haystack.includes(norm(term)));
}

export function matchesFlightTemplateRules(candidate: FlightTemplateMatchable, rules: FlightTemplateRules): boolean {
  const proof = candidate.proofN;
  if (rules.proofMin != null && (proof == null || proof < rules.proofMin)) return false;
  if (rules.proofMax != null && (proof == null || proof > rules.proofMax)) return false;

  const text = [
    candidate.name,
    candidate.category,
    candidate.subcategory,
    candidate.style,
    candidate.proofDisplay,
    candidate.productionText,
    ...(candidate.tags ?? []),
  ]
    .map(norm)
    .filter(Boolean)
    .join(" ");

  if (rules.categories?.length) {
    const categoryText = norm(candidate.category);
    const hasCategory = rules.categories.some((category) => categoryText === norm(category) || text.includes(norm(category)));
    if (!hasCategory) return false;
  }

  if (rules.textAny?.length && !includesAny(text, rules.textAny)) return false;

  if (rules.bottledInBond) {
    const saysBonded = includesAny(text, ["bottled in bond", "bottled-in-bond", "bonded"]);
    const isBondProof = proof != null && Math.abs(proof - 100) < 0.01;
    if (!saysBonded || !isBondProof) return false;
  }

  return true;
}
