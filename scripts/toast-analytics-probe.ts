/**
 * Toast Analytics (era) API probe — what does enterprise-metrics:read expose?
 *
 * Run:  npx dotenv -e .env.local -- tsx scripts/toast-analytics-probe.ts
 *
 * Flow (per Toast docs):
 *   POST /era/v1/metrics/{timeRange}  {startBusinessDate,endBusinessDate,
 *        restaurantIds,excludedRestaurantIds,groupBy}  -> reportRequestGuid
 *   GET  /era/v1/metrics/{timeRange}/{reportRequestGuid}  -> report data (async)
 *
 * Uses our existing token (enterprise-metrics:read). Identifies the restaurant
 * via restaurantIds in the body (NOT the Toast-Restaurant-External-ID header),
 * so this uses raw fetch rather than the operational client wrapper. Prints the
 * shape of what comes back — this is your own reporting data, not secrets.
 */

import { getAccessToken } from "../src/lib/integrations/toast/auth";
import { getToastConfig } from "../src/lib/integrations/toast/config";

function ymd(d: Date): number {
  return Number(
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
  );
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { hostname } = getToastConfig();
  const guid = process.env.TOAST_RESTAURANT_GUID!;
  const token = await getAccessToken();

  const day = new Date();
  day.setDate(day.getDate() - 1); // yesterday (closed day)
  const timeRange = "day"; // for `day`, start and end must be the SAME business date

  const body = {
    startBusinessDate: ymd(day),
    endBusinessDate: ymd(day),
    restaurantIds: [guid],
    excludedRestaurantIds: [],
    groupBy: [],
  };

  console.log(`— Toast Analytics probe — ${hostname}`);
  console.log(`  POST /era/v1/metrics/${timeRange}`, JSON.stringify(body), "\n");

  const post = await fetch(`${hostname}/era/v1/metrics/${timeRange}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const postText = (await post.text()).trim();
  console.log(`  POST -> ${post.status} ${post.statusText}`);
  if (!post.ok) {
    console.log("  body:", postText.slice(0, 600));
    if (post.status === 403) console.log("\n  403 — enterprise-metrics:read may not cover /era/metrics, or wrong host.");
    if (post.status === 404) console.log("\n  404 — analytics endpoints may be on a different host than", hostname);
    process.exit(1);
  }

  // Response is the reportRequestGuid (a JSON string).
  const reportGuid = postText.replace(/^"|"$/g, "");
  console.log(`  reportRequestGuid = ${reportGuid}\n`);

  // Poll the GET until the report is ready.
  for (let attempt = 1; attempt <= 8; attempt++) {
    const get = await fetch(`${hostname}/era/v1/metrics/${reportGuid}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (get.status === 200) {
      const data = JSON.parse(await get.text());
      console.log(`  GET -> 200 (attempt ${attempt}). Report ready.\n`);
      summarize(data);
      return;
    }
    if (get.status === 202 || get.status === 404) {
      console.log(`  GET -> ${get.status} (attempt ${attempt}); report still generating, waiting…`);
      await sleep(2500);
      continue;
    }
    const t = (await get.text()).slice(0, 400);
    console.log(`  GET -> ${get.status} ${get.statusText}: ${t}`);
    return;
  }
  console.log("  Report did not become ready within the poll window. Try again shortly.");
}

function summarize(data: unknown) {
  console.log("— What enterprise-metrics:read returned —");
  const top = Array.isArray(data) ? data : [data];
  console.log("  top-level:", Array.isArray(data) ? `array(${data.length})` : "object");
  const sample = top[0];
  if (sample && typeof sample === "object") {
    console.log("  fields available:", Object.keys(sample as object).join(", "));
    // Show a compact sample row (your own numbers).
    console.log("\n  sample row:", JSON.stringify(sample, null, 2).slice(0, 1200));
  } else {
    console.log("  payload:", JSON.stringify(data).slice(0, 1200));
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
