/**
 * Reusable Toast bottle pull for the Spirit Vault (extracted from
 * `scripts/pull-toast-spirits.ts`). Used by the admin "add a bottle" checklist and
 * the weekly auto-ingest job. Toast owns commerce; only price/GUID/identity come
 * from here — never knowledge fields.
 *
 * Each bottle is listed on Toast at 2-3 pour sizes = distinct GUIDs/prices, so the
 * checklist must dedupe by NORMALIZED NAME (not GUID). `pullToastBottles` returns
 * the raw GUID-level rows; `dedupeByName` collapses them into one entry per bottle
 * with a price anchor (the largest pour). Toast has no rate-limit backoff, so call
 * this on an operator action or a scheduled job — never per page render.
 */
import { toastFetch } from "@/lib/integrations/toast/client";

const TARGET_GROUP = /spir(?:it|t)s\s*\*\*/i; // groups named "<Category> Spirits**" (tolerates the "Spirts**" typo)

interface MenuItem {
  name?: string;
  guid?: string;
  price?: number | null;
}
interface MenuGroup {
  name?: string;
  menuItems?: MenuItem[];
  menuGroups?: MenuGroup[];
}
interface MenusResponse {
  menus?: { menuGroups?: MenuGroup[] }[];
}

export interface ToastBottle {
  name: string;
  guid: string;
  priceUsd: number | null;
  category: string;
}

function categoryOf(trail: string[]): string {
  const seg = trail.find((s) => TARGET_GROUP.test(s)) ?? trail[trail.length - 1] ?? "";
  return seg.replace(/\s*\*\*\s*$/, "").replace(/\s*Spir(?:it|t)s$/i, "").trim() || seg;
}

function walk(group: MenuGroup, trail: string[], out: ToastBottle[]): void {
  const here = [...trail, group.name ?? "(unnamed group)"];
  const matched = here.some((g) => TARGET_GROUP.test(g));
  if (matched) {
    for (const item of group.menuItems ?? []) {
      if (!item.guid) continue;
      out.push({
        name: item.name ?? "(unnamed)",
        guid: item.guid,
        priceUsd: item.price == null ? null : Number(item.price),
        category: categoryOf(here),
      });
    }
  }
  for (const sub of group.menuGroups ?? []) walk(sub, here, out);
}

/** All bottles under the "* Spirits**" groups, deduped by GUID (across menus/dayparts). */
export async function pullToastBottles(): Promise<ToastBottle[]> {
  const data = await toastFetch<MenusResponse>("/menus/v2/menus");
  const rows: ToastBottle[] = [];
  for (const menu of data.menus ?? []) {
    for (const group of menu.menuGroups ?? []) walk(group, [], rows);
  }
  const byGuid = new Map<string, ToastBottle>();
  for (const r of rows) if (!byGuid.has(r.guid)) byGuid.set(r.guid, r);
  return [...byGuid.values()];
}

// ── Normalized-name dedup (collapse pour-size duplicates + common label typos) ──
const NAME_FIXES: [RegExp, string][] = [
  [/bookers/gi, "booker's"],
  [/bulliet/gi, "bulleit"],
  [/jepthra/gi, "jeptha"],
  [/whistelpig/gi, "whistlepig"],
  [/\bfinsh\b/gi, "finish"],
  [/\broyle\b/gi, "royal"],
  [/overhault/gi, "overholt"],
  [/suntori/gi, "suntory"],
];

export function normalizeBottleName(name: string): string {
  let n = name.toLowerCase();
  for (const [re, to] of NAME_FIXES) n = n.replace(re, to);
  return n.replace(/[^a-z0-9]+/g, " ").trim();
}

export interface ToastBottleGroup {
  normName: string;
  displayName: string;
  guids: string[];
  category: string;
  /** GUID of the largest pour (heuristic: highest price) — the 2oz anchor. */
  anchorGuid: string;
  anchorPriceUsd: number | null;
}

/** Collapse GUID-level rows into one entry per bottle, keyed by normalized name. */
export function dedupeByName(bottles: ToastBottle[]): ToastBottleGroup[] {
  const groups = new Map<string, ToastBottle[]>();
  for (const b of bottles) {
    const key = normalizeBottleName(b.name);
    const g = groups.get(key);
    if (g) g.push(b);
    else groups.set(key, [b]);
  }
  const out: ToastBottleGroup[] = [];
  for (const [normName, rows] of groups) {
    const anchor = [...rows].sort((a, b) => (b.priceUsd ?? -1) - (a.priceUsd ?? -1))[0];
    out.push({
      normName,
      displayName: anchor.name,
      guids: rows.map((r) => r.guid),
      category: anchor.category,
      anchorGuid: anchor.guid,
      anchorPriceUsd: anchor.priceUsd,
    });
  }
  return out.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
