/**
 * Read-only pull of the Toast menu, focused on the Spirit Vault source groups.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/pull-toast-spirits.ts
 *
 * Calls the Toast Menus API (GET /menus/v2/menus), walks the group tree, and
 * prints every item (name, GUID, price) under groups whose name matches
 * "Echo Spirits" or "New Bar". No writes, no DB — just reads the menu so we can
 * build the Spirit Vault list + real pricing from the source of truth.
 *
 * If the configured client lacks the `menus.read` scope, Toast returns 403 —
 * the error body is printed so we know to widen the client's scopes.
 */

import { toastFetch, ToastApiError } from "../src/lib/integrations/toast/client";
import { isToastConfigured, missingToastEnvVars } from "../src/lib/integrations/toast/config";

// Bottle groups in Toast are named "<Category> Spirits**" (note the "Spirts**"
// typo on one Rum group). Match all of them — that's the Spirit Vault master list.
const TARGET_GROUPS = [/spir(?:it|t)s\s*\*\*/i];

interface MenuItem {
  name?: string;
  guid?: string;
  price?: number | null;
  pricingStrategy?: string;
}
interface MenuGroup {
  name?: string;
  guid?: string;
  menuItems?: MenuItem[];
  menuGroups?: MenuGroup[];
}
interface Menu {
  name?: string;
  menuGroups?: MenuGroup[];
}
interface MenusResponse {
  menus?: Menu[];
}

type Row = { group: string; name: string; guid: string; price: string; strategy: string };

function walk(group: MenuGroup, trail: string[], out: Row[], allGroupNames: Set<string>) {
  const name = group.name ?? "(unnamed group)";
  allGroupNames.add(name);
  const here = [...trail, name];
  const matched = TARGET_GROUPS.some((re) => here.some((g) => re.test(g)));
  for (const item of group.menuItems ?? []) {
    if (matched) {
      out.push({
        group: here.join(" › "),
        name: item.name ?? "(unnamed)",
        guid: item.guid ?? "",
        price: item.price == null ? "—" : `$${Number(item.price).toFixed(2)}`,
        strategy: item.pricingStrategy ?? "",
      });
    }
  }
  for (const sub of group.menuGroups ?? []) walk(sub, here, out, allGroupNames);
}

async function main() {
  if (!isToastConfigured()) {
    console.error("Toast not configured — missing:", missingToastEnvVars().join(", "));
    process.exit(1);
  }

  console.error("Fetching /menus/v2/menus …");
  let data: MenusResponse;
  try {
    data = await toastFetch<MenusResponse>("/menus/v2/menus");
  } catch (e) {
    if (e instanceof ToastApiError) {
      console.error(`Toast API ${e.status} ${e.statusText} on ${e.path}`);
      console.error("Body:", e.body);
      if (e.status === 403) {
        console.error("\n→ The configured Toast client likely lacks the `menus.read` scope.");
      }
      process.exit(2);
    }
    throw e;
  }

  const rows: Row[] = [];
  const allGroupNames = new Set<string>();
  for (const menu of data.menus ?? []) {
    for (const group of menu.menuGroups ?? []) walk(group, [], rows, allGroupNames);
  }

  if (rows.length === 0) {
    console.log("No matching groups found. All group names seen:");
    console.log([...allGroupNames].sort().map((g) => `  • ${g}`).join("\n"));
    return;
  }

  // Dedupe by GUID (same bottle appears across many menus/dayparts).
  const byGuid = new Map<string, Row>();
  for (const r of rows) if (r.guid && !byGuid.has(r.guid)) byGuid.set(r.guid, r);
  const unique = [...byGuid.values()];

  // Category = the top-level "<X> Spirits**" segment of the group trail.
  const catOf = (trail: string) => {
    const seg = trail.split(" › ").find((s) => /spir(?:it|t)s\s*\*\*/i.test(s)) ?? trail;
    return seg.replace(/\s*\*\*\s*$/, "").replace(/\s*Spir(?:it|t)s$/i, "").trim() || seg;
  };
  const byCat = new Map<string, Row[]>();
  for (const r of unique) {
    const c = catOf(r.group);
    (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(r);
  }

  console.log(`\nMenus returned: ${data.menus?.length ?? 0}`);
  console.log(`Spirit rows (all menus): ${rows.length}  →  unique bottles: ${unique.length}\n`);
  console.log("By category:");
  for (const [cat, items] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(items.length).padStart(3)}  ${cat}`);
  }

  const out = process.env.TOAST_SPIRITS_OUT || require("path").join(process.cwd(), "toast-spirits-inventory.local.json");
  require("fs").writeFileSync(
    out,
    JSON.stringify(
      { pulledFrom: "toast /menus/v2/menus", uniqueCount: unique.length, byCategory: Object.fromEntries([...byCat].map(([c, i]) => [c, i.map((r) => ({ name: r.name, guid: r.guid, price: r.price }))])) },
      null,
      2,
    ),
  );
  console.log(`\nFull deduped list written to ${out}`);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
