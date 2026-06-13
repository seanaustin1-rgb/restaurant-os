/**
 * Verification harness for the Profit First Allocation & Variance engine core
 * (src/lib/profit-first/allocation.ts). Pure math — no DB, no Toast, no Clerk.
 *
 * Run: npx tsx scripts/test-allocation-engine.ts
 *
 * Simulates the spec's deposit pattern over two weeks (Monday lump batching
 * Fri+Sat+Sun, single weekday settlements Tue–Fri) and asserts the engine's
 * headline behaviors:
 *   1. Tax skimmed off the top BEFORE the TAP split (no false-green buckets).
 *   2. TAP allocations sum to the allocable remainder (100% split).
 *   3. Variance is a rolling-7-day read — a bucket looks underwater mid-week
 *      then recovers after Monday's lump (weekly truth, not daily panic).
 *   4. Beer has no TAP %, so it accrues $0 yet still draws down → red variance
 *      (the "unbudgeted beer" signal).
 *   5. Tax Reserve is binary OK/SHORT per sub-ledger.
 */
import {
  runAllocation,
  rollingVariance,
  computeVariance,
  drawDownBalance,
  taxReserveStatus,
  nextSweepDate,
  daysUntilNextSweep,
  type LedgerEntry,
} from "../src/lib/profit-first/allocation";
import type { Taps } from "../src/lib/profit-first/calculator";

// Held TAPs (32/28, no spill) — the live Customer Zero split.
const TAPS: Taps = {
  profitPct: 5,
  ownerPayPct: 5,
  cogsFoodPct: 18,
  cogsLiquorPct: 12,
  laborPct: 32,
  opexPct: 28,
  spillPct: 0,
};

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pad = (s: string, n: number) => s.padEnd(n);

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  console.log(`  ${cond ? "✓" : "✗ FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// ── Two-week timeline. Day 0 = Mon 2026-06-01. Deposits land per the spec:
//    Mon = weekend batch (~3× weekday), Tue–Fri = single days, Sat/Sun = none.
interface Day {
  date: Date;
  dow: string;
  deposit: number;
  salesTax: number; // Toast-reported sales tax collected (skim)
  payrollAccrual: number; // daily payroll-tax accrual
  obligations: Partial<Record<"food" | "liquor" | "beer" | "labor" | "opex", number>>;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function makeDay(i: number): Day {
  const date = new Date(2026, 5, 1 + i);
  const dow = DOW[i % 7];
  let deposit = 0;
  if (dow === "Mon") deposit = 27000; // Fri+Sat+Sun batched
  else if (dow === "Tue" || dow === "Wed" || dow === "Thu" || dow === "Fri") deposit = 6000;
  // Sales tax ≈ 5% of the deposit (Toast figure); payroll tax accrues daily.
  const salesTax = Math.round(deposit * 0.05);
  const payrollAccrual = deposit > 0 ? 900 : 0;

  // Real payments clearing through Plaid (obligations).
  const obligations: Day["obligations"] = {};
  if (dow === "Tue") {
    obligations.liquor = 3000; // PLCB
    obligations.beer = 2500; // Wilsbach — NO TAP allocation → should go red
  }
  if (dow === "Wed") obligations.food = 7000; // PFG invoice (lumpy, within the weekly food TAP)
  if (dow === "Thu") obligations.labor = 13000; // payroll clears
  if (dow === "Fri") obligations.opex = 4500; // recurring opex

  return { date, dow, deposit, salesTax, payrollAccrual, obligations };
}

const days = Array.from({ length: 14 }, (_, i) => makeDay(i));

// Ledgers per draw-down bucket (for rolling variance).
const ledgers: Record<string, LedgerEntry[]> = { food: [], liquor: [], beer: [], labor: [], opex: [] };
const cumAllocated: Record<string, number> = { food: 0, liquor: 0, beer: 0, labor: 0, opex: 0 };
const cumCleared: Record<string, number> = { food: 0, liquor: 0, beer: 0, labor: 0, opex: 0 };

// Tax Reserve sub-ledgers.
let salesReserve = 0;
let payrollReserve = 0;

console.log("\n══════ ALLOCATION ENGINE — 2-week simulation (held TAPs 32/28, no spill) ══════\n");
console.log(pad("Day", 12) + pad("Deposit", 10) + pad("SalesTax", 10) + pad("Allocable", 11) + pad("→Food", 9) + pad("→Liquor", 9) + pad("→Labor", 9) + pad("→OpEx", 9));

for (const day of days) {
  if (day.deposit > 0) {
    const r = runAllocation({
      grossDeposit: day.deposit,
      salesTaxCollected: day.salesTax,
      payrollTaxAccrued: day.payrollAccrual,
      taps: TAPS,
    });

    // Invariant: allocations sum to the allocable remainder.
    const sum =
      r.byBucket.profit + r.byBucket.ownerPay + r.byBucket.cogsFood + r.byBucket.cogsLiquor +
      r.byBucket.labor + r.byBucket.opex + r.byBucket.spill;
    if (Math.abs(sum - r.allocableRemainder) > 0.05) {
      check(`allocations sum to allocable on ${day.dow}`, false, `${sum} vs ${r.allocableRemainder}`);
    }

    cumAllocated.food += r.byBucket.cogsFood;
    cumAllocated.liquor += r.byBucket.cogsLiquor;
    cumAllocated.labor += r.byBucket.labor;
    cumAllocated.opex += r.byBucket.opex;
    // beer: no TAP % → $0 allocation (intentionally absent).

    ledgers.food.push({ date: day.date, allocated: r.byBucket.cogsFood, obligation: 0 });
    ledgers.liquor.push({ date: day.date, allocated: r.byBucket.cogsLiquor, obligation: 0 });
    ledgers.labor.push({ date: day.date, allocated: r.byBucket.labor, obligation: 0 });
    ledgers.opex.push({ date: day.date, allocated: r.byBucket.opex, obligation: 0 });
    ledgers.beer.push({ date: day.date, allocated: 0, obligation: 0 });

    salesReserve += r.salesTaxSkimmed;
    payrollReserve += r.payrollTaxSkimmed;

    const label = `${day.dow} ${day.date.getDate()}`;
    console.log(
      pad(label, 12) + pad(money(r.grossDeposit), 10) + pad(money(r.salesTaxSkimmed), 10) +
      pad(money(r.allocableRemainder), 11) + pad(money(r.byBucket.cogsFood), 9) +
      pad(money(r.byBucket.cogsLiquor), 9) + pad(money(r.byBucket.labor), 9) + pad(money(r.byBucket.opex), 9),
    );
  }

  // Obligations clear (draw-down + ledger).
  for (const [k, amt] of Object.entries(day.obligations)) {
    cumCleared[k] += amt!;
    ledgers[k].push({ date: day.date, allocated: 0, obligation: amt! });
  }

  // Sales tax: Davo pulls daily (assume it matches collection → reserve nets to 0).
  salesReserve -= day.salesTax;
  // Payroll tax: pulled Thursday (the week's accrual).
  if (day.dow === "Thu") {
    const weekPull = 900 * 5; // Mon-Fri accrual
    payrollReserve -= weekPull;
  }
}

console.log("\n── Draw-down balances after 2 weeks (allocated − cleared) ──");
for (const k of ["food", "liquor", "beer", "labor", "opex"]) {
  const bal = drawDownBalance(cumAllocated[k], cumCleared[k]);
  console.log(`  ${pad(k, 8)} allocated ${pad(money(cumAllocated[k]), 9)} cleared ${pad(money(cumCleared[k]), 9)} balance ${money(bal)}`);
}

// ── Behavior 3: the spec's core claim — read variance on the ROLLING WINDOW,
//    not day-by-day. Same bucket (FOOD), same day (Wed wk2, when the $7k invoice
//    clears): a naive single-day reading panics red; the rolling-7d reading,
//    which sees Monday's lump and the week's deposits, reads true (green). ──
console.log("\n── FOOD on Wed wk2 (the $7k invoice clears): daily panic vs rolling-7d truth ──");
const wed2 = days[9].date; // Wed week 2 — trailing window is now a full week
const vDaily = computeVariance(864, 7000); // just that day's food allocation vs the invoice
const vRolling = rollingVariance(ledgers.food, wed2);
console.log(`  single-day : allocated ${money(vDaily.allocated)} vs owed ${money(vDaily.obligations)} → gap ${money(vDaily.dollarGap)} (${vDaily.pctDiff}%) ${vDaily.signal.toUpperCase()}`);
console.log(`  rolling-7d : allocated ${money(vRolling.allocated)} vs owed ${money(vRolling.obligations)} → gap ${money(vRolling.dollarGap)} (${vRolling.pctDiff}%) ${vRolling.signal.toUpperCase()}`);
check("single-day reading falsely panics (red)", vDaily.signal === "red");
check("rolling-7d reading reads true (green)", vRolling.signal === "green", `was ${vRolling.signal}`);

// ── Behavior 4: beer has no allocation but real spend → red ──
const vBeer = rollingVariance(ledgers.beer, days[6].date); // end of week 1
console.log("\n── Beer (no TAP %): ──");
console.log(`  wk1 : allocated ${money(vBeer.allocated)} vs owed ${money(vBeer.obligations)} → ${vBeer.signal.toUpperCase()}`);
check("beer is red (unbudgeted — needs its own %)", vBeer.signal === "red");

// ── Behavior 5: Tax Reserve OK/SHORT ──
console.log("\n── Tax Reserve (binary) ──");
check("sales reserve OK when covering pull", taxReserveStatus(500, 480) === "OK");
check("payroll reserve SHORT when under pull", taxReserveStatus(4000, 4500) === "SHORT");
console.log(`  end-of-sim sales reserve=${money(salesReserve)} payroll reserve=${money(payrollReserve)}`);

// ── Unit checks: variance thresholds + sweep dates ──
console.log("\n── Threshold + sweep unit checks ──");
check("gap +6% → green", computeVariance(106, 100).signal === "green");
check("gap +2% → yellow", computeVariance(102, 100).signal === "yellow");
check("gap −10% → red", computeVariance(90, 100).signal === "red");
check("no obligations → green", computeVariance(50, 0).signal === "green");
// Use UTC-constructed dates + UTC getters — the engine works in UTC (the
// allocation basis is Prisma @db.Date = midnight UTC), so these assertions are
// timezone-independent.
check("sweep after the 5th → the 10th", nextSweepDate(new Date(Date.UTC(2026, 5, 5))).getUTCDate() === 10);
check("sweep after the 12th → the 25th", nextSweepDate(new Date(Date.UTC(2026, 5, 12))).getUTCDate() === 25);
check("sweep after the 26th → next month's 10th", nextSweepDate(new Date(Date.UTC(2026, 5, 26))).getUTCMonth() === 6);
check("days-until-sweep from the 8th = 2", daysUntilNextSweep(new Date(Date.UTC(2026, 5, 8))) === 2);

console.log(`\n══════ ${failures === 0 ? "ALL CHECKS PASSED ✓" : `${failures} CHECK(S) FAILED ✗`} ══════\n`);
process.exit(failures === 0 ? 0 : 1);
