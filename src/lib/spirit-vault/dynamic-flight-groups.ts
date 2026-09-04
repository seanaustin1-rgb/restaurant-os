// Auto-generated flight template suggestions based on what's actually in the
// vault. Analyzes the candidate pour pool, finds categories not well-served by
// the static template registry, and builds templates the manager can pick from.
// Pure function — no DB, no side effects.

import type { FlightTemplate } from "./flight-templates";
import type { FlightCandidatePour } from "./flight-template-candidates";

const MIN_POURS_FOR_SUGGESTION = 3;

// ── Category metadata ──

type CategoryMeta = {
  throughLine: string;
  itemNote: string;
  autoOrder: FlightTemplate["autoOrder"];
};

const KNOWN_CATEGORIES: Record<string, CategoryMeta> = {
  Rum: {
    throughLine:
      "A rum flight exploring how geography, distillation, and barrel aging create distinct expressions — from light column-distilled to rich pot-still sippers.",
    itemNote: "Notice the base — molasses, fresh cane, or agricole — and how barrel time reshapes it.",
    autoOrder: "slot-order",
  },
  Vodka: {
    throughLine:
      "A vodka comparison showing how base ingredient, distillation method, and filtration create surprisingly distinct expressions of a spirit often called neutral.",
    itemNote: "Look past neutral — the base grain, water source, and distillation method leave their mark.",
    autoOrder: "slot-order",
  },
  Gin: {
    throughLine:
      "A gin flight tracing how botanical recipes, distillation technique, and base spirit shape flavor from classic London Dry to contemporary styles.",
    itemNote: "Beyond juniper — notice how each distiller's botanical bill creates a different balance.",
    autoOrder: "slot-order",
  },
  Bourbon: {
    throughLine:
      "A bourbon tour comparing how mash bill, barrel entry proof, warehouse position, and age create distinct expressions of America's native spirit.",
    itemNote: "Compare the sweetness, spice, and oak influence — each distillery's signature in the glass.",
    autoOrder: "proof-asc",
  },
};

function categoryMeta(category: string): CategoryMeta {
  return (
    KNOWN_CATEGORIES[category] ?? {
      throughLine: `A ${category.toLowerCase()} flight comparing styles, ages, and production methods across the category.`,
      itemNote: `Compare each expression — how does origin, method, and age shape ${category.toLowerCase()} differently?`,
      autoOrder: "slot-order" as const,
    }
  );
}

// ── Core logic ──

/** Collect all categories that any static template's slot rules mention. */
function coveredCategories(staticTemplates: readonly FlightTemplate[]): Set<string> {
  const covered = new Set<string>();
  for (const t of staticTemplates) {
    for (const slot of t.slots) {
      if (slot.rules.categories) {
        for (const cat of slot.rules.categories) {
          covered.add(cat.toLowerCase());
        }
      }
    }
  }
  return covered;
}

/** Group pours by category, returning only categories with enough pours. */
function poursByCategory(
  pours: readonly FlightCandidatePour[],
  minCount: number,
): Map<string, FlightCandidatePour[]> {
  const groups = new Map<string, FlightCandidatePour[]>();
  for (const pour of pours) {
    const cat = pour.category;
    if (!cat) continue;
    let list = groups.get(cat);
    if (!list) {
      list = [];
      groups.set(cat, list);
    }
    list.push(pour);
  }
  // Drop categories below the threshold
  for (const [cat, list] of groups) {
    if (list.length < minCount) groups.delete(cat);
  }
  return groups;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a dynamic FlightTemplate for one category. Uses a single pool slot
 * (same shape as most static templates) so the existing grouping, ranking,
 * and picker code works unchanged.
 */
function categoryTemplate(category: string, pourCount: number): FlightTemplate {
  const meta = categoryMeta(category);
  return {
    key: `dyn-${slugify(category)}`,
    name: `${category} Flight`,
    description: `${pourCount} ${category.toLowerCase()} spirits in your vault.`,
    throughLine: meta.throughLine,
    maxPours: 4,
    autoOrder: meta.autoOrder,
    slots: [
      {
        key: "pool",
        label: category,
        rules: { categories: [category] },
        itemNote: meta.itemNote,
      },
    ],
  };
}

/**
 * Analyze the pour pool and generate flight templates for categories not
 * already well-served by the static registry. Returns templates sorted by
 * eligible pour count (most options first).
 */
export function generateDynamicGroupings(
  pours: readonly FlightCandidatePour[],
  staticTemplates: readonly FlightTemplate[],
): FlightTemplate[] {
  const covered = coveredCategories(staticTemplates);
  const groups = poursByCategory(pours, MIN_POURS_FOR_SUGGESTION);

  const templates: FlightTemplate[] = [];

  for (const [category, categoryPours] of groups) {
    if (covered.has(category.toLowerCase())) continue;
    templates.push(categoryTemplate(category, categoryPours.length));
  }

  // Sort by pour count descending so the richest suggestions come first
  templates.sort((a, b) => {
    const aCount = groups.get(a.slots[0]?.rules.categories?.[0] ?? "")?.length ?? 0;
    const bCount = groups.get(b.slots[0]?.rules.categories?.[0] ?? "")?.length ?? 0;
    return bCount - aCount;
  });

  return templates;
}
