// Applies pending Prisma migrations during the Vercel *production* build, so the
// "operator applies migrations before deploy" step happens automatically on a
// production deploy — no terminal required.
//
// Guards, so it never surprises anyone:
//   - Runs ONLY on Vercel production builds (VERCEL_ENV === "production").
//     Preview and local builds skip it, so they never touch a database.
//   - Skips (does not fail) when DATABASE_URL is absent.
//   - `prisma migrate deploy` is idempotent: it applies only not-yet-applied
//     migrations and no-ops once they're in, so repeat deploys are safe.
//
// Migrations here are additive (new tables + nullable columns + new enum values),
// so applying them never mutates or drops existing rows.
import { execSync } from "node:child_process";

const isVercelProd = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";
if (!isVercelProd) {
  console.log(`[vercel-migrate] skip — not a Vercel production build (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.log("[vercel-migrate] skip — DATABASE_URL not set");
  process.exit(0);
}
// `prisma migrate deploy` connects via directUrl (DIRECT_URL). If only the pooled
// DATABASE_URL is configured, fall back to it (note: some poolers, e.g. pgbouncer,
// reject migrations — set a real DIRECT_URL if migrate fails on the pooled URL).
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.log("[vercel-migrate] DIRECT_URL not set — falling back to DATABASE_URL");
}

console.log("[vercel-migrate] applying pending migrations…");
execSync("npx prisma migrate deploy", { stdio: "inherit" });
console.log("[vercel-migrate] done.");
