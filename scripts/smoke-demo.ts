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
    const tour = await getWithRetry("/demo/tour");
    return { demo, tour, logs: logs.text, usedWindowsDemoWorkaround: useWindowsDemoWorkaround };
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

function isWindowsTlsPrismaError(logs: string) {
  return logs.includes("No credentials are available in the security package");
}

async function main() {
  loadLocalEnv();

  let result = await runAttempt(false);
  if (
    result.tour.status !== 200 &&
    process.platform === "win32" &&
    process.env.DEMO_DIRECT_URL &&
    isWindowsTlsPrismaError(result.logs)
  ) {
    result = await runAttempt(true);
  }

  assertProbe(result.demo, /OutFront|demo/i);
  assertProbe(result.tour, /Go-Live Coach/i);
  assertProbe(result.tour, /Aura|Market energy/i);
  assertPublicDemoChrome(result.demo);
  assertPublicDemoChrome(result.tour);
  assertLowFrictionDemoCopy(result.demo);
  assertLowFrictionDemoCopy(result.tour);

  console.log(
    JSON.stringify(
      {
        ok: true,
        port: PORT,
        usedWindowsDemoWorkaround: result.usedWindowsDemoWorkaround,
        routes: [
          { path: result.demo.path, status: result.demo.status },
          { path: result.tour.path, status: result.tour.status },
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
