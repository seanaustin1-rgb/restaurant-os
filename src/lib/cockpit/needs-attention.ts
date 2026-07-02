// Shared "needs attention" ordering for the cockpit surfaces (brokerage agents,
// rental properties). Unhealthy items float to the top — red before yellow — with
// a caller-supplied tiebreak (e.g. biggest company dollar at risk, or thinnest
// owner proceeds). Green items are dropped: the result is the early-action list.
// Pure and does not mutate its input.
export type CockpitHealth = "green" | "yellow" | "red";

const SEVERITY: Record<CockpitHealth, number> = { red: 2, yellow: 1, green: 0 };

export function orderByNeedsAttention<T>(
  items: readonly T[],
  getHealth: (item: T) => CockpitHealth,
  tieBreak: (a: T, b: T) => number,
): T[] {
  // `filter` returns a fresh array, so the following `sort` never mutates `items`.
  return items
    .filter((item) => getHealth(item) !== "green")
    .sort((a, b) => SEVERITY[getHealth(b)] - SEVERITY[getHealth(a)] || tieBreak(a, b));
}
