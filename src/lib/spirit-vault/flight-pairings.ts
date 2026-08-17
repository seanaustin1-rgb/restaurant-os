// Suggests a 1-2 bite accompaniment for a pour from its flavor profile. Internal
// staff aid only (prep sheet) — never guest-facing. Deterministic so the same
// spirit always seeds the same starting suggestion; staff edit from there.

export const FLAVOR_AXES = ["Sweet", "Oak", "Spice", "Fruit", "Smoke", "Earth", "Herbal"] as const;
export type FlavorAxis = (typeof FLAVOR_AXES)[number];

// One primary bite per dominant flavor axis — pairing logic a bartender would recognize.
const AXIS_BITE: Record<FlavorAxis, string> = {
  Sweet: "Salted caramel",
  Oak: "Aged cheddar",
  Spice: "Peppered charcuterie",
  Fruit: "Dried cherries",
  Smoke: "Smoked almonds",
  Earth: "Blue cheese",
  Herbal: "Rosemary cracker",
};

function toFlavor(input: unknown): Record<string, number> {
  return input && typeof input === "object" ? (input as Record<string, number>) : {};
}

/** 1-2 suggested bites, led by the pour's dominant flavor axis. A second bite is
 *  added only when the next axis is meaningfully present (>= 4/10). */
export function suggestBites(flavor: unknown, max = 2): string[] {
  const f = toFlavor(flavor);
  const ranked = FLAVOR_AXES.map((axis) => ({ axis, v: typeof f[axis] === "number" ? f[axis] : 0 })).sort(
    (a, b) => b.v - a.v || FLAVOR_AXES.indexOf(a.axis) - FLAVOR_AXES.indexOf(b.axis),
  );

  const picks: string[] = [];
  for (const { axis, v } of ranked) {
    if (picks.length >= Math.max(1, max)) break;
    if (picks.length >= 1 && v < 4) break; // a 2nd bite only if the axis actually shows up
    picks.push(AXIS_BITE[axis]);
  }
  return picks;
}
