/**
 * Toast Loyalty probe — is a Loyalty tile (accruals / redemptions / program ROI)
 * buildable from the access we already have?
 *
 * Run: npx dotenv -e .env.local -o -- tsx scripts/toast-loyalty-probe.ts [yyyyMMdd] [daysBack]
 *
 * Two angles, because Toast exposes loyalty in two places:
 *   1. A dedicated loyalty read API — try a few candidate paths and classify the
 *      HTTP status (403 = scope not granted, 404 = no such read path here, 200 =
 *      data). Toast's loyalty integration is largely partner/push-side, so a read
 *      API may simply not exist for a Standard client — the probe tells us which.
 *   2. The ORDERS payload — loyalty redemptions/accruals ride along on the check
 *      (appliedLoyaltyInfo, loyalty discounts), the same way per-check taxAmount
 *      carried the sales tax we now skim. We have `orders:read`, so this is the
 *      realistic source: pull recent days, deep-scan for loyalty-shaped keys, and
 *      report exactly what's present with sample values.
 *
 * Read-only; ~paced to stay under rate limits. No DB writes.
 */

import { toastFetch, ToastApiError } from "../src/lib/integrations/toast/client";

function bd(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 1. Candidate dedicated loyalty endpoints ────────────────────────────────
// We don't assume the exact path/scope; we classify what comes back. The
// `{guid}`/`{bd}` placeholders are filled per call.
const LOYALTY_ENDPOINTS: { label: string; path: string }[] = [
  { label: "loyalty/v1/config", path: "/loyalty/v1/config" },
  { label: "loyalty/v1/programs", path: "/loyalty/v1/programs" },
  { label: "loyalty/v1/accounts", path: "/loyalty/v1/accounts" },
  { label: "loyalty/v1/transactions(bd)", path: `/loyalty/v1/transactions?businessDate=${bd(1)}` },
  { label: "loyalty/v1/inquiry", path: "/loyalty/v1/inquiry" },
];

async function probeEndpoint(label: string, path: string): Promise<void> {
  try {
    const res = await toastFetch<unknown>(path);
    const shape = Array.isArray(res) ? `array(${res.length})` : typeof res === "object" && res ? "object" : typeof res;
    console.log(`  ${label.padEnd(28)} 200   REACHABLE — ${shape}`);
  } catch (e) {
    if (e instanceof ToastApiError) {
      const verdict =
        e.status === 403
          ? "not granted — request loyalty scope"
          : e.status === 404
            ? "404 — no such read path for this client"
            : e.status === 400
              ? "400 — reachable, wrong params (scope OK)"
              : `${e.status} ${e.statusText}`;
      console.log(`  ${label.padEnd(28)} ${String(e.status).padEnd(5)} ${verdict}`);
    } else {
      console.log(`  ${label.padEnd(28)} ERR   ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

// ── 2. Loyalty signals inside the orders payload ────────────────────────────
const LOYALTY_KEY = /loyalt|reward|accru|redempt|points/i;

interface Json {
  [k: string]: unknown;
}

/** Collect dotted key-paths (and a sample value) anywhere a loyalty-ish key appears. */
function scanLoyalty(node: unknown, path: string, hits: Map<string, string>, depth = 0): void {
  if (depth > 8 || node == null) return;
  if (Array.isArray(node)) {
    // Scan the first couple of elements — enough to discover the shape.
    for (let i = 0; i < Math.min(node.length, 2); i++) scanLoyalty(node[i], `${path}[]`, hits, depth + 1);
    return;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Json)) {
      const child = path ? `${path}.${k}` : k;
      if (LOYALTY_KEY.test(k) && !hits.has(child)) {
        const sample =
          v == null
            ? "null"
            : typeof v === "object"
              ? Array.isArray(v)
                ? `array(${(v as unknown[]).length})`
                : `{${Object.keys(v as Json).slice(0, 6).join(",")}}`
              : String(v).slice(0, 60);
        hits.set(child, sample);
      }
      scanLoyalty(v, child, hits, depth + 1);
    }
  }
}

async function scanOrdersForDay(businessDate: string, hits: Map<string, string>): Promise<{ orders: number; flagged: number }> {
  let page = 1;
  let orders = 0;
  let flagged = 0;
  for (;;) {
    let batch: Json[];
    try {
      batch = await toastFetch<Json[]>(`/orders/v2/ordersBulk?businessDate=${businessDate}&page=${page}&pageSize=100`);
    } catch (e) {
      if (e instanceof ToastApiError) {
        console.log(`  orders ${businessDate} p${page} → ${e.status} ${e.statusText}`);
        return { orders, flagged };
      }
      throw e;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const o of batch) {
      orders++;
      const before = hits.size;
      scanLoyalty(o, "order", hits);
      // Cheap per-order flag: did this order add or already contain loyalty keys?
      if (hits.size > before || LOYALTY_KEY.test(JSON.stringify(o))) flagged++;
    }
    if (batch.length < 100) break;
    page++;
    await sleep(300);
  }
  return { orders, flagged };
}

async function main() {
  const target = process.argv[2] ?? bd(1);
  const daysBack = Number(process.argv[3] ?? 14);
  console.log("— Toast Loyalty probe —\n");

  console.log("1) Dedicated loyalty read endpoints:");
  for (const ep of LOYALTY_ENDPOINTS) {
    await probeEndpoint(ep.label, ep.path);
    await sleep(1100);
  }

  console.log(`\n2) Loyalty signals inside orders (scan ${target} back ${daysBack} day(s)):`);
  const hits = new Map<string, string>();
  let totalOrders = 0;
  let totalFlagged = 0;
  // Walk back from the target date until we've covered the window or found signal.
  const startY = Number(target.slice(0, 4));
  const startM = Number(target.slice(4, 6)) - 1;
  const startD = Number(target.slice(6, 8));
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(Date.UTC(startY, startM, startD - i));
    const businessDate = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    const { orders, flagged } = await scanOrdersForDay(businessDate, hits);
    totalOrders += orders;
    totalFlagged += flagged;
    console.log(`  ${businessDate}: ${orders} order(s), ${flagged} with loyalty-ish data`);
    await sleep(400);
  }

  console.log("\n— Loyalty fields found on orders —");
  if (hits.size === 0) {
    console.log("  (none) — no loyalty/reward/redemption fields in the scanned orders.");
  } else {
    for (const [k, sample] of [...hits.entries()].sort()) console.log(`  ${k} = ${sample}`);
  }

  console.log("\n— Verdict —");
  console.log(`  Orders scanned: ${totalOrders} · with loyalty-ish data: ${totalFlagged}`);
  if (hits.size > 0) {
    console.log("  ✓ Loyalty data rides on the ORDERS payload — a Loyalty tile (redemptions, discount $,");
    console.log("    member vs. non-member check averages) is buildable from orders:read, NO extra scope.");
  } else if (totalOrders > 0) {
    console.log("  ✗ Orders carry no loyalty fields in this window. Either the program isn't running these");
    console.log("    days, or loyalty lives only in a dedicated API — see section 1 for the scope verdict.");
  } else {
    console.log("  ⚠ No orders returned — check orders:read access / the date window before judging loyalty.");
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
