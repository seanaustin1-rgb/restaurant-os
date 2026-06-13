/**
 * Toast Orders API — locate & sum "sales tax collected" for a business date.
 *
 * Now that orders:read is granted, this is the source for the pre-allocation
 * Sales-Tax skim (spec §C3.3). Pulls all orders for a businessDate via
 * /orders/v2/ordersBulk (paged), inspects the check shape, and sums per-check
 * taxAmount. Compares the total against era netSales for a sanity check.
 *
 * Run: npx dotenv -e .env.local -o -- tsx scripts/toast-orders-tax-probe.ts [yyyyMMdd]
 */
import { toastFetch } from "../src/lib/integrations/toast/client";
import { getMetricsForDay } from "../src/lib/integrations/toast/analytics";

function defaultBusinessDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ToastCheck {
  taxAmount?: number;
  totalAmount?: number;
  amount?: number;
  [k: string]: unknown;
}
interface ToastOrder {
  guid?: string;
  checks?: ToastCheck[];
  voided?: boolean;
  deleted?: boolean;
  [k: string]: unknown;
}

async function main() {
  const bd = process.argv[2] ?? defaultBusinessDate();
  console.log(`— Toast Orders tax probe — businessDate=${bd}\n`);

  let page = 1;
  const pageSize = 100;
  let all: ToastOrder[] = [];
  for (;;) {
    const batch = await toastFetch<ToastOrder[]>(
      `/orders/v2/ordersBulk?businessDate=${bd}&page=${page}&pageSize=${pageSize}`,
    );
    if (!Array.isArray(batch) || batch.length === 0) break;
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    page++;
    await sleep(300);
  }
  console.log(`Fetched ${all.length} orders across ${page} page(s).`);

  if (all.length) {
    const sampleCheck = all.find((o) => o.checks?.length)?.checks?.[0];
    if (sampleCheck) {
      const taxKeys = Object.keys(sampleCheck).filter((k) => /tax/i.test(k));
      console.log("Sample check tax-like keys:", taxKeys.length ? taxKeys.join(", ") : "NONE");
      console.log("Sample check keys:", Object.keys(sampleCheck).join(", "));
    }
  }

  let taxTotal = 0;
  let checkCount = 0;
  let voidedSkipped = 0;
  for (const o of all) {
    if (o.voided || o.deleted) {
      voidedSkipped++;
      continue;
    }
    for (const c of o.checks ?? []) {
      taxTotal += Number(c.taxAmount ?? 0);
      checkCount++;
    }
  }

  console.log(`\nChecks summed: ${checkCount}  (voided/deleted orders skipped: ${voidedSkipped})`);
  console.log(`SALES TAX COLLECTED (sum of check.taxAmount): $${taxTotal.toFixed(2)}`);

  try {
    const era = await getMetricsForDay(Number(bd));
    const net = Number(era[0]?.netSalesAmount ?? 0);
    console.log(`\nera netSalesAmount same day: $${net.toFixed(2)}`);
    if (net > 0) console.log(`tax / netSales = ${((taxTotal / net) * 100).toFixed(2)}%  (PA ~6% food+non-alc, alcohol exempt)`);
  } catch (e) {
    console.log("(era cross-check skipped:", e instanceof Error ? e.message : e, ")");
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
