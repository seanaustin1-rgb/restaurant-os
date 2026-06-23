import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

type Probe = {
  path: string;
  status?: number;
  body: string;
  error?: string;
};

const ROOT = process.cwd();
const PORT = Number(process.env.SMOKE_PORT ?? 3100);
const READY_TIMEOUT_MS = 45_000;
const ROUTE_TIMEOUT_MS = 60_000;

function loadLocalEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] != null) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function appendParam(url: string, param: string) {
  return `${url}${url.includes("?") ? "&" : "?"}${param}`;
}

function envForAttempt(useWindowsDemoWorkaround: boolean): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PORT) };
  if (useWindowsDemoWorkaround && process.env.DEMO_DIRECT_URL) {
    env.DEMO_DATABASE_URL = appendParam(process.env.DEMO_DIRECT_URL, "sslmode=disable");
  }
  return env;
}

function startServer(useWindowsDemoWorkaround: boolean): ChildProcess {
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  return spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: ROOT,
    env: envForAttempt(useWindowsDemoWorkaround),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(child: ChildProcess, logs: { text: string }) {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    if (logs.text.includes("Ready")) return;
    if (child.exitCode != null) throw new Error(`dev server exited early with code ${child.exitCode}`);
    await sleep(500);
  }
  throw new Error("dev server did not become ready in time");
}

function get(route: string): Promise<Probe> {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "127.0.0.1", port: PORT, path: route, timeout: ROUTE_TIMEOUT_MS },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve({ path: route, status: res.statusCode, body }));
      },
    );
    req.on("error", (error) => resolve({ path: route, body: "", error: error.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ path: route, body: "", error: "timeout" });
    });
  });
}

async function getWithRetry(route: string): Promise<Probe> {
  const first = await get(route);
  if (first.error === "timeout") return get(route);
  return first;
}

async function runAttempt(useWindowsDemoWorkaround: boolean) {
  const child = startServer(useWindowsDemoWorkaround);
  const logs = { text: "" };
  child.stdout?.on("data", (data) => {
    logs.text += data.toString();
  });
  child.stderr?.on("data", (data) => {
    logs.text += data.toString();
  });

  try {
    await waitForReady(child, logs);
    const demo = await getWithRetry("/demo");
    const service = await getWithRetry("/demo/service");
    const realEstate = await getWithRetry("/demo/real-estate");
    const retail = await getWithRetry("/demo/retail");
    const tour = await getWithRetry("/demo/tour");
    const restaurantTour = await getWithRetry("/demo/tour/restaurant");
    const serviceTour = await getWithRetry("/demo/tour/service");
    const contractorTour = await getWithRetry("/demo/tour/contractor");
    const brokerageTour = await getWithRetry("/demo/tour/real-estate");
    const retailTour = await getWithRetry("/demo/tour/retail");
    return {
      demo,
      service,
      realEstate,
      retail,
      tour,
      restaurantTour,
      serviceTour,
      contractorTour,
      brokerageTour,
      retailTour,
      logs: logs.text,
      usedWindowsDemoWorkaround: useWindowsDemoWorkaround,
    };
  } finally {
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
  }
}

function assertProbe(probe: Probe, expectedText: RegExp) {
  if (probe.status !== 200) throw new Error(`${probe.path} returned ${probe.status ?? probe.error ?? "unknown error"}`);
  if (!expectedText.test(probe.body)) throw new Error(`${probe.path} did not include expected page content`);
}

function assertPublicDemoChrome(probe: Probe) {
  const protectedLinks = [
    "/dashboard",
    "/connections",
    "/transactions",
    "/settings",
    "/modules",
    "/onboarding",
  ];

  for (const href of protectedLinks) {
    if (probe.body.includes(`href="${href}`)) {
      throw new Error(`${probe.path} rendered a protected app link (${href})`);
    }
  }
}

function assertLowFrictionDemoCopy(probe: Probe) {
  const highFrictionCopy = [
    "Minimum auto-input",
    "Minimum sources to plan",
    "Missing minimum",
    "Connect your bank and POS",
    "Unlocks when you connect your bank",
  ];

  for (const text of highFrictionCopy) {
    if (probe.body.includes(text)) {
      throw new Error(`${probe.path} rendered high-friction demo copy (${text})`);
    }
  }
}

function assertNumberEntryPath(demo: Probe, service: Probe, realEstate: Probe, retail: Probe, tour: Probe, restaurantTour: Probe, serviceTour: Probe, contractorTour: Probe, brokerageTour: Probe, retailTour: Probe) {
  if (!demo.body.includes("Average weekly sales")) {
    throw new Error("/demo did not render the weekly number-entry form");
  }
  if (!demo.body.includes("Rent / lease")) {
    throw new Error("/demo did not render fixed-expense bill buckets");
  }
  if (!service.body.includes("Average weekly revenue")) {
    throw new Error("/demo/service did not render the service number-entry form");
  }
  if (!realEstate.body.includes("Company Dollar")) {
    throw new Error("/demo/real-estate did not render the brokerage number-entry form");
  }
  if (!retail.body.includes("Average weekly sales") || !retail.body.includes("POS system")) {
    throw new Error("/demo/retail did not render the retail number-entry form");
  }
  if (!tour.body.includes("What kind of business do you want to see?")) {
    throw new Error("/demo/tour did not render the business-type selector");
  }
  if (!tour.body.includes('href="/demo/tour/service"') || !tour.body.includes('href="/demo/tour/real-estate"')) {
    throw new Error("/demo/tour did not render industry tour links");
  }
  if (!restaurantTour.body.includes("Demo Bistro") || !restaurantTour.body.includes("Operating pressure")) {
    throw new Error("/demo/tour/restaurant did not render the restaurant tour");
  }
  if (!restaurantTour.body.includes("90%") || !restaurantTour.body.includes("floor")) {
    throw new Error("/demo/tour/restaurant did not render demo cash and discipline cues");
  }
  if (!serviceTour.body.includes("Keystone Service Co.") || !serviceTour.body.includes("Delivery pressure")) {
    throw new Error("/demo/tour/service did not render the service tour");
  }
  if (!contractorTour.body.includes("Iron Ridge Field Services") || !contractorTour.body.includes("Job Margin")) {
    throw new Error("/demo/tour/contractor did not render the contractor feedback tour");
  }
  if (!brokerageTour.body.includes("Harbor &amp; Main Realty") || !brokerageTour.body.includes("Split pressure") || !brokerageTour.body.includes("70-75%")) {
    throw new Error("/demo/tour/real-estate did not render the brokerage tour");
  }
  if (!retailTour.body.includes("Copper Lane Goods") || !retailTour.body.includes('href="/demo/retail"')) {
    throw new Error("/demo/tour/retail did not render the retail tour and estimate CTA");
  }
}

function isWindowsTlsPrismaError(logs: string) {
  return logs.includes("No credentials are available in the security package");
}

async function main() {
  loadLocalEnv();

  let result = await runAttempt(false);
  if (
    (result.restaurantTour.status !== 200 || result.restaurantTour.body.includes("The live demo is being prepared")) &&
    process.platform === "win32" &&
    process.env.DEMO_DIRECT_URL &&
    (result.restaurantTour.body.includes("The live demo is being prepared") || isWindowsTlsPrismaError(result.logs))
  ) {
    result = await runAttempt(true);
  }

  assertProbe(result.demo, /OutFront|demo/i);
  assertProbe(result.service, /Service business estimate|Average weekly revenue/i);
  assertProbe(result.realEstate, /Company Dollar|brokerage/i);
  assertProbe(result.retail, /Retail estimate|POS system/i);
  assertProbe(result.tour, /What kind of business/i);
  assertProbe(result.restaurantTour, /Go-Live Coach/i);
  assertProbe(result.serviceTour, /Delivery pressure|Client momentum/i);
  assertProbe(result.contractorTour, /Job Margin|Backlog/i);
  assertProbe(result.brokerageTour, /Split pressure|Pipeline momentum/i);
  assertPublicDemoChrome(result.demo);
  assertPublicDemoChrome(result.service);
  assertPublicDemoChrome(result.realEstate);
  assertPublicDemoChrome(result.retail);
  assertPublicDemoChrome(result.tour);
  assertPublicDemoChrome(result.restaurantTour);
  assertPublicDemoChrome(result.serviceTour);
  assertPublicDemoChrome(result.contractorTour);
  assertPublicDemoChrome(result.brokerageTour);
  assertLowFrictionDemoCopy(result.demo);
  assertLowFrictionDemoCopy(result.service);
  assertLowFrictionDemoCopy(result.realEstate);
  assertLowFrictionDemoCopy(result.retail);
  assertLowFrictionDemoCopy(result.tour);
  assertLowFrictionDemoCopy(result.restaurantTour);
  assertLowFrictionDemoCopy(result.serviceTour);
  assertLowFrictionDemoCopy(result.contractorTour);
  assertLowFrictionDemoCopy(result.brokerageTour);
  assertNumberEntryPath(result.demo, result.service, result.realEstate, result.retail, result.tour, result.restaurantTour, result.serviceTour, result.contractorTour, result.brokerageTour, result.retailTour);

  console.log(
    JSON.stringify(
      {
        ok: true,
        port: PORT,
        usedWindowsDemoWorkaround: result.usedWindowsDemoWorkaround,
        routes: [
          { path: result.demo.path, status: result.demo.status },
          { path: result.service.path, status: result.service.status },
          { path: result.realEstate.path, status: result.realEstate.status },
          { path: result.retail.path, status: result.retail.status },
          { path: result.tour.path, status: result.tour.status },
          { path: result.restaurantTour.path, status: result.restaurantTour.status },
          { path: result.serviceTour.path, status: result.serviceTour.status },
          { path: result.contractorTour.path, status: result.contractorTour.status },
          { path: result.brokerageTour.path, status: result.brokerageTour.status },
          { path: result.retailTour.path, status: result.retailTour.status },
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
