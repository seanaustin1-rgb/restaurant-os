/**
 * Toast Labor API — does /labor/v1/shifts return SCHEDULED shifts?
 *
 * Toast Support (2026-06-13): scheduled hours come from the Labor API
 * (/labor/v1/shifts), not Standard API "scopes"; Sling-published schedules show
 * up here. We have labor.* granted, so probe whether scheduled shift data is
 * actually present for this restaurant — if yes, scheduled-vs-actual labor is
 * buildable with NO separate Sling integration.
 *
 * Run: npx dotenv -e .env.local -o -- tsx scripts/toast-shifts-probe.ts [yyyyMMdd]
 */
import { toastFetch, ToastApiError } from "../src/lib/integrations/toast/client";

function bd(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Shift {
  inDate?: string;
  outDate?: string;
  [k: string]: unknown;
}

async function tryParams(label: string, qs: string): Promise<Shift[] | null> {
  try {
    const rows = await toastFetch<Shift[]>(`/labor/v1/shifts?${qs}`);
    console.log(`  [${label}] ${qs} → ${Array.isArray(rows) ? rows.length + " shift(s)" : typeof rows}`);
    return Array.isArray(rows) ? rows : null;
  } catch (e) {
    const msg = e instanceof ToastApiError ? `${e.status} ${e.statusText}` : e instanceof Error ? e.message : String(e);
    console.log(`  [${label}] ${qs} → ERROR ${msg}`);
    return null;
  }
}

async function main() {
  const target = process.argv[2] ?? bd(1);
  console.log(`— Toast /labor/v1/shifts probe (target businessDate=${target}) —\n`);

  // Try the documented param shapes (Toast labor endpoints vary by businessDate vs date range).
  let shifts = await tryParams("businessDate", `businessDate=${target}`);
  await sleep(1100);
  if (!shifts || shifts.length === 0) {
    // ISO start/end (UTC day window).
    const y = target.slice(0, 4), m = target.slice(4, 6), d = target.slice(6, 8);
    shifts = await tryParams("startDate/endDate", `startDate=${y}-${m}-${d}T00:00:00.000Z&endDate=${y}-${m}-${d}T23:59:59.999Z`);
    await sleep(1100);
  }
  // Scan back a couple weeks for ANY day with scheduled shifts.
  if (!shifts || shifts.length === 0) {
    console.log("\n  No shifts on target day — scanning back 14 days for any scheduled shifts…");
    for (let back = 2; back <= 14 && (!shifts || shifts.length === 0); back++) {
      shifts = await tryParams(`day -${back}`, `businessDate=${bd(back)}`);
      await sleep(1100);
    }
  }

  if (shifts && shifts.length > 0) {
    const s = shifts[0];
    console.log(`\n✓ SCHEDULED SHIFTS PRESENT — ${shifts.length} on the matched day.`);
    console.log("Sample shift keys:", Object.keys(s).join(", "));
    console.log("Sample inDate/outDate:", s.inDate, "→", s.outDate);
    let totalHrs = 0;
    for (const sh of shifts) {
      if (sh.inDate && sh.outDate) totalHrs += (new Date(sh.outDate).getTime() - new Date(sh.inDate).getTime()) / 3.6e6;
    }
    console.log(`Computed scheduled hours that day: ${totalHrs.toFixed(1)}`);
    console.log("\n→ Scheduled-vs-actual labor IS buildable from /labor/v1/shifts (no Sling integration needed).");
  } else {
    console.log("\n✗ No scheduled shifts returned. Either the schedule isn't published into Toast,");
    console.log("  or a different param/endpoint is needed. Scheduled-vs-actual stays blocked on the schedule source.");
  }
}

main().catch((e) => {
  console.error("Unexpected error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
