import type { HealthStatus } from "@/lib/profit-first/calculator";

// Launch readiness — a pure assessment of whether the environment is configured
// for a real production launch (real money), not just a POC demo. It reads a
// plain env map so it's fully testable and side-effect free; scripts/check-launch.ts
// runs it against process.env and prints the report.
//
// Three outcomes per check, reusing the app's health vocabulary:
//   • green  (pass) — production-ready
//   • yellow (warn) — fine for a POC, must change before real money
//   • red    (fail) — missing/unsafe; blocks a real launch
// `ready` is true only when nothing is red (warnings are allowed for a POC).

export type ReadinessLevel = HealthStatus; // green = pass, yellow = warn, red = fail

export interface ReadinessCheck {
  key: string;
  label: string;
  level: ReadinessLevel;
  detail: string;
}

export interface ReadinessReport {
  checks: ReadinessCheck[];
  ready: boolean; // no red checks
  failCount: number;
  warnCount: number;
}

type Env = Record<string, string | undefined>;
const has = (env: Env, name: string) => !!env[name]?.trim();

// Every var the app needs wired to boot and run in production. Optional
// integrations (Toast, Aura, Anthropic) are intentionally excluded — the app
// degrades to honest empty states without them.
export const REQUIRED_ENV = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "ENCRYPTION_KEY",
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

// The all-zeros key from .env.example / CI placeholders — never ship it.
const PLACEHOLDER_ENCRYPTION_KEY = "0".repeat(64);

export function assessLaunchReadiness(env: Env): ReadinessReport {
  const checks: ReadinessCheck[] = [];
  const add = (key: string, label: string, level: ReadinessLevel, detail: string) =>
    checks.push({ key, label, level, detail });

  // 1. Required env present.
  const missing = REQUIRED_ENV.filter((name) => !has(env, name));
  if (missing.length === 0) {
    add("required-env", "Required environment variables", "green", "all present");
  } else {
    add("required-env", "Required environment variables", "red", `missing: ${missing.join(", ")}`);
  }

  // 2. Clerk instance — live vs. test.
  const pk = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const sk = env.CLERK_SECRET_KEY?.trim() ?? "";
  if (!pk || !sk) {
    add("clerk-instance", "Clerk production instance", "red", "Clerk keys not set");
  } else if (pk.startsWith("pk_live_") && sk.startsWith("sk_live_")) {
    add("clerk-instance", "Clerk production instance", "green", "live instance");
  } else {
    add("clerk-instance", "Clerk production instance", "yellow", "test instance — rotate to a production instance before real money");
  }

  // 3. Plaid environment.
  const plaidEnv = env.PLAID_ENV?.trim().toLowerCase() ?? "";
  if (plaidEnv === "production") {
    add("plaid-env", "Plaid environment", "green", "production");
  } else if (plaidEnv === "sandbox" || plaidEnv === "development") {
    add("plaid-env", "Plaid environment", "yellow", `${plaidEnv} — switch to production for real bank data`);
  } else {
    add("plaid-env", "Plaid environment", "red", "PLAID_ENV not set");
  }

  // 4. Encryption key — 32-byte hex, not the placeholder.
  const enc = env.ENCRYPTION_KEY?.trim() ?? "";
  if (!enc) {
    add("encryption-key", "Encryption key", "red", "ENCRYPTION_KEY not set");
  } else if (enc === PLACEHOLDER_ENCRYPTION_KEY) {
    add("encryption-key", "Encryption key", "red", "still the all-zeros placeholder — generate a real 32-byte key");
  } else if (!/^[0-9a-fA-F]{64}$/.test(enc)) {
    add("encryption-key", "Encryption key", "red", "not a 32-byte (64 hex char) key");
  } else {
    add("encryption-key", "Encryption key", "green", "32-byte hex");
  }

  // 5. Inngest dev flag must be unset in production (else cloud points at a dev server).
  if (has(env, "INNGEST_DEV")) {
    add("inngest-dev", "INNGEST_DEV unset", "red", "INNGEST_DEV is set — unset it in production");
  } else {
    add("inngest-dev", "INNGEST_DEV unset", "green", "unset");
  }

  // 6. App URL — https and not localhost.
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  if (!appUrl) {
    add("app-url", "Public app URL", "red", "NEXT_PUBLIC_APP_URL not set");
  } else if (appUrl.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(appUrl)) {
    add("app-url", "Public app URL", "green", appUrl);
  } else {
    add("app-url", "Public app URL", "yellow", `${appUrl} — set to the public https URL`);
  }

  const failCount = checks.filter((c) => c.level === "red").length;
  const warnCount = checks.filter((c) => c.level === "yellow").length;
  return { checks, ready: failCount === 0, failCount, warnCount };
}
