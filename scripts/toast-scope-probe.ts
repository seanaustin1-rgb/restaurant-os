/**
 * Toast scope probe — discover which read scopes this API client already has.
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/toast-scope-probe.ts
 *
 * Hits one small, representative read endpoint per scope and reports the HTTP
 * status: 200 = granted, 403 = not granted (request it from Toast), 400/404 =
 * endpoint/params issue (not a scope verdict). Read-only; ~1.1s between calls to
 * stay under rate limits. Maps each scope to the dashboard tile it unlocks.
 */

import { toastFetch, ToastApiError } from "../src/lib/integrations/toast/client";

// Yesterday in Toast's businessDate format (yyyyMMdd) — a closed day.
function yesterdayBusinessDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

const BD = yesterdayBusinessDate();

const PROBES: Array<{ scope: string; tile: string; path: string }> = [
  { scope: "labor.employees", tile: "Labor Hours", path: "/labor/v1/employees" },
  { scope: "labor.jobs", tile: "Labor Hours", path: "/labor/v1/jobs" },
  { scope: "labor.timeEntries", tile: "Labor Hours", path: `/labor/v1/timeEntries?businessDate=${BD}` },
  { scope: "orders", tile: "Sales Mix / Covers / Menu Eng.", path: `/orders/v2/ordersBulk?businessDate=${BD}&pageSize=1` },
  { scope: "config (menus)", tile: "Menu Engineering / Food Cost", path: "/menus/v2/menus" },
  { scope: "config (diningOptions)", tile: "Sales Mix", path: "/config/v2/diningOptions" },
  { scope: "restaurants", tile: "(general info)", path: "/restaurants/v1/restaurants/SELF" },
  { scope: "cashmgmt", tile: "Tax Vault (deposits)", path: `/cashmgmt/v1/deposits?businessDate=${BD}` },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`— Toast scope probe (businessDate=${BD}) —\n`);
  const rows: Array<{ scope: string; tile: string; status: string; verdict: string }> = [];

  for (const p of PROBES) {
    // The "restaurants" probe needs the real GUID in the path; toastFetch already
    // sends it as a header, so use a lightweight known endpoint instead.
    const path = p.path.replace("/SELF", `/${process.env.TOAST_RESTAURANT_GUID}`);
    let status = "";
    let verdict = "";
    try {
      await toastFetch(path);
      status = "200";
      verdict = "GRANTED ✓";
    } catch (err) {
      if (err instanceof ToastApiError) {
        status = String(err.status);
        verdict =
          err.status === 403
            ? "not granted — request it"
            : err.status === 400
              ? "400 (params, not scope)"
              : err.status === 404
                ? "404 (path/params)"
                : `${err.status} ${err.statusText}`;
      } else {
        status = "ERR";
        verdict = err instanceof Error ? err.message : String(err);
      }
    }
    rows.push({ scope: p.scope, tile: p.tile, status, verdict });
    console.log(`  ${p.scope.padEnd(22)} ${status.padEnd(5)} ${verdict}`);
    await sleep(1100);
  }

  const granted = rows.filter((r) => r.status === "200").map((r) => r.scope);
  const missing = rows.filter((r) => r.verdict.startsWith("not granted")).map((r) => r.scope);
  console.log("\n— Summary —");
  console.log("Granted :", granted.length ? granted.join(", ") : "(none)");
  console.log("Missing :", missing.length ? missing.join(", ") : "(none)");
  console.log(
    "\nFor Labor Hours (the next module) you need: labor.employees, labor.jobs, labor.timeEntries.",
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
