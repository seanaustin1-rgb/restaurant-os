import { describe, it, expect } from "vitest";
import { assessLaunchReadiness, REQUIRED_ENV } from "./readiness";

// A fully production-ready env, used as the baseline each test perturbs.
const prodEnv = (): Record<string, string> => ({
  DATABASE_URL: "postgresql://u:p@db.example.com:5432/app",
  DIRECT_URL: "postgresql://u:p@db.example.com:5432/app",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_abc123",
  CLERK_SECRET_KEY: "sk_live_abc123",
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon_key",
  ENCRYPTION_KEY: "a".repeat(64),
  PLAID_CLIENT_ID: "client",
  PLAID_SECRET: "secret",
  PLAID_ENV: "production",
  INNGEST_EVENT_KEY: "evt",
  INNGEST_SIGNING_KEY: "sign",
  RESEND_API_KEY: "re_123",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
});

const levelOf = (env: Record<string, string | undefined>, key: string) =>
  assessLaunchReadiness(env).checks.find((c) => c.key === key)?.level;

describe("assessLaunchReadiness", () => {
  it("reports ready with all-green for a fully production env", () => {
    const r = assessLaunchReadiness(prodEnv());
    expect(r.ready).toBe(true);
    expect(r.failCount).toBe(0);
    expect(r.warnCount).toBe(0);
    expect(r.checks.every((c) => c.level === "green")).toBe(true);
  });

  it("fails when a required var is missing", () => {
    const env = prodEnv();
    delete (env as Record<string, string | undefined>).DATABASE_URL;
    const r = assessLaunchReadiness(env);
    expect(r.ready).toBe(false);
    expect(levelOf(env, "required-env")).toBe("red");
    expect(r.checks.find((c) => c.key === "required-env")?.detail).toContain("DATABASE_URL");
  });

  it("treats blank/whitespace as missing", () => {
    const env = { ...prodEnv(), RESEND_API_KEY: "   " };
    expect(levelOf(env, "required-env")).toBe("red");
  });

  it("warns (not fails) on a Clerk test instance — POC is allowed", () => {
    const env = { ...prodEnv(), NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_abc", CLERK_SECRET_KEY: "sk_test_abc" };
    const r = assessLaunchReadiness(env);
    expect(levelOf(env, "clerk-instance")).toBe("yellow");
    expect(r.ready).toBe(true); // warnings don't block
    expect(r.warnCount).toBeGreaterThan(0);
  });

  it("warns on Plaid sandbox", () => {
    expect(levelOf({ ...prodEnv(), PLAID_ENV: "sandbox" }, "plaid-env")).toBe("yellow");
  });

  it("fails on the all-zeros placeholder encryption key", () => {
    const env = { ...prodEnv(), ENCRYPTION_KEY: "0".repeat(64) };
    expect(levelOf(env, "encryption-key")).toBe("red");
    expect(assessLaunchReadiness(env).ready).toBe(false);
  });

  it("fails on an encryption key of the wrong shape", () => {
    expect(levelOf({ ...prodEnv(), ENCRYPTION_KEY: "tooshort" }, "encryption-key")).toBe("red");
    expect(levelOf({ ...prodEnv(), ENCRYPTION_KEY: "z".repeat(64) }, "encryption-key")).toBe("red"); // non-hex
  });

  it("fails when INNGEST_DEV is left set", () => {
    const env = { ...prodEnv(), INNGEST_DEV: "1" };
    expect(levelOf(env, "inngest-dev")).toBe("red");
    expect(assessLaunchReadiness(env).ready).toBe(false);
  });

  it("warns on a localhost or non-https app URL", () => {
    expect(levelOf({ ...prodEnv(), NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, "app-url")).toBe("yellow");
    expect(levelOf({ ...prodEnv(), NEXT_PUBLIC_APP_URL: "http://app.example.com" }, "app-url")).toBe("yellow");
  });

  it("covers exactly the documented required vars", () => {
    // Guards against the list silently drifting from .env.example.
    expect([...REQUIRED_ENV].sort()).toEqual(
      [
        "CLERK_SECRET_KEY",
        "DATABASE_URL",
        "DIRECT_URL",
        "ENCRYPTION_KEY",
        "INNGEST_EVENT_KEY",
        "INNGEST_SIGNING_KEY",
        "NEXT_PUBLIC_APP_URL",
        "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "PLAID_CLIENT_ID",
        "PLAID_SECRET",
        "PLAID_ENV",
        "RESEND_API_KEY",
      ].sort(),
    );
  });
});
