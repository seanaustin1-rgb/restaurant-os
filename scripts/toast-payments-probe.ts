/**
 * Toast Analytics (era) guest/payments — find the request body that works, then
 * check whether the result carries tax.
 *
 * Run: npx dotenv -e .env.local -o -- tsx scripts/toast-payments-probe.ts
 *
 * /era/v1/guest/payments/day is REACHABLE with enterprise-metrics:read (returns
 * 400 "Invalid request body", not 403). So the scope is fine — we just need the
 * right payload. Tries several body shapes; on the first that isn't 400, dumps
 * the row keys + any tax-shaped field.
 */
import { getAccessToken } from "../src/lib/integrations/toast/auth";
import { getToastConfig } from "../src/lib/integrations/toast/config";

const TAX_HINT = /tax/i;
const PATH = "/era/v1/guest/payments/day";

function bd(d: Date): number {
  return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attempt(label: string, body: object): Promise<boolean> {
  const { hostname } = getToastConfig();
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  const post = await fetch(`${hostname}${PATH}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await post.text();
  console.log(`\n[${label}] POST → ${post.status} ${post.statusText}`);
  if (post.status === 400) {
    console.log("  400:", text.slice(0, 220));
    return false;
  }
  if (!post.ok) {
    console.log("  body:", text.slice(0, 220));
    return false;
  }
  const guid = text.trim().replace(/^"|"$/g, "");
  console.log("  reportGuid:", guid, "— polling…");
  for (let i = 0; i < 8; i++) {
    const get = await fetch(`${hostname}/era/v1/guest/payments/${guid}`, { headers });
    if (get.status === 200) {
      const data = JSON.parse((await get.text()) || "[]");
      const rows = Array.isArray(data) ? data : [data];
      const row = rows.find((r) => r && Object.keys(r).length) ?? rows[0];
      if (!row) { console.log("  (empty result — but body shape ACCEPTED)"); return true; }
      const keys = Object.keys(row);
      console.log("  KEYS:", keys.join(", "));
      const taxKeys = keys.filter((k) => TAX_HINT.test(k));
      console.log("  >>> TAX-LIKE:", taxKeys.length ? taxKeys.map((k) => `${k}=${row[k]}`).join(", ") : "NONE");
      console.log("  sample row:", JSON.stringify(row).slice(0, 400));
      return true;
    }
    if (get.status === 202 || get.status === 404) { await sleep(2000); continue; }
    console.log(`  GET → ${get.status}: ${(await get.text()).slice(0, 180)}`);
    return true;
  }
  console.log("  not ready after polls (body shape ACCEPTED though)");
  return true;
}

async function main() {
  const { restaurantGuid } = getToastConfig();
  const day = new Date();
  day.setDate(day.getDate() - 1);
  const date = bd(day);

  const variants: Array<[string, object]> = [
    ["range+ids only", { startBusinessDate: date, endBusinessDate: date, restaurantIds: [restaurantGuid] }],
    ["range+ids+excluded", { startBusinessDate: date, endBusinessDate: date, restaurantIds: [restaurantGuid], excludedRestaurantIds: [] }],
    ["single businessDate", { businessDate: date, restaurantIds: [restaurantGuid] }],
    ["restaurantGuids key", { startBusinessDate: date, endBusinessDate: date, restaurantGuids: [restaurantGuid] }],
    ["guids singular+date str", { startBusinessDate: String(date), endBusinessDate: String(date), restaurantIds: [restaurantGuid] }],
  ];

  for (const [label, body] of variants) {
    const ok = await attempt(label, body);
    if (ok) { console.log("\n✓ Body shape accepted — see above."); break; }
    await sleep(1100);
  }
}

main().catch((e) => { console.error("Unexpected:", e instanceof Error ? e.message : e); process.exit(1); });
