import { MODULES, type ModuleDef } from "@/lib/modules";

// Pure helpers for the per-user module ordering. No DB import, so they stay
// trivially testable and reusable on the client.

const VALID_KEYS = new Set(MODULES.map((m) => m.key));

/** Keep only known module keys, de-duplicated, preserving the given order. */
export function sanitizeModuleOrder(order: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of order) {
    if (typeof k === "string" && VALID_KEYS.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/**
 * MODULES arranged by a saved key order. Unknown/stale keys are ignored and any
 * modules missing from the saved order (e.g. newly shipped ones) are appended in
 * their default order — so a saved layout never hides or drops a module.
 */
export function orderModules(savedOrder: readonly unknown[] | null | undefined): ModuleDef[] {
  const byKey = new Map(MODULES.map((m) => [m.key, m]));
  const ordered: ModuleDef[] = [];
  const seen = new Set<string>();
  if (savedOrder) {
    for (const k of savedOrder) {
      if (typeof k !== "string") continue;
      const m = byKey.get(k);
      if (m && !seen.has(k)) {
        ordered.push(m);
        seen.add(k);
      }
    }
  }
  for (const m of MODULES) if (!seen.has(m.key)) ordered.push(m);
  return ordered;
}
