/**
 * Pure unit checks for the sweep schedule logic (no DB).
 * Run: npx tsx scripts/test-ledger-sweeps.ts
 */
import { prevSweepDate, isSweepDue, nextSweepDate } from "../src/lib/profit-first/allocation";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}
const U = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

console.log("prevSweepDate:");
check("on the 5th → prev 25th of last month", iso(prevSweepDate(U(2026, 6, 5))) === "2026-05-25");
check("on the 10th → the 10th", iso(prevSweepDate(U(2026, 6, 10))) === "2026-06-10");
check("on the 18th → the 10th", iso(prevSweepDate(U(2026, 6, 18))) === "2026-06-10");
check("on the 25th → the 25th", iso(prevSweepDate(U(2026, 6, 25))) === "2026-06-25");
check("on the 30th → the 25th", iso(prevSweepDate(U(2026, 6, 30))) === "2026-06-25");
check("Jan 3 → prev Dec 25", iso(prevSweepDate(U(2026, 1, 3))) === "2025-12-25");

console.log("nextSweepDate:");
check("on the 12th → the 25th", iso(nextSweepDate(U(2026, 6, 12))) === "2026-06-25");
check("on the 26th → next month 10th", iso(nextSweepDate(U(2026, 6, 26))) === "2026-07-10");

console.log("isSweepDue:");
check("never swept → due", isSweepDue(U(2026, 6, 18), null) === true);
check("swept on the 10th, now the 18th → not due (no new sweep date)", isSweepDue(U(2026, 6, 18), U(2026, 6, 10)) === false);
check("swept on the 10th, now the 25th → due", isSweepDue(U(2026, 6, 25), U(2026, 6, 10)) === true);
check("swept on the 25th, now the 26th → not due", isSweepDue(U(2026, 6, 26), U(2026, 6, 25)) === false);
check("swept last month 25th, now this month 11th → due", isSweepDue(U(2026, 6, 11), U(2026, 5, 25)) === true);

console.log(`\n${fail === 0 ? "✓ ALL PASS" : "✗ FAILURES"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
