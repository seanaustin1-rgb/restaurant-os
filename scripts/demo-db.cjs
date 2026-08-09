/**
 * Run a Prisma command against the SEPARATE demo database only.
 *
 * Remaps DEMO_DIRECT_URL onto DATABASE_URL / DIRECT_URL, and
 * hard-aborts if they're missing or equal to production — so a demo migration can
 * never touch the production database.
 *
 * Usage (loads .env.local for the DEMO_* vars):
 *   npx dotenv -e .env.local -- node scripts/demo-db.cjs "npx prisma migrate deploy"
 *   npx dotenv -e .env.local -- node scripts/demo-db.cjs "npx prisma db push"
 */
const { spawnSync } = require("child_process");

const cmd = process.argv[2];
if (!cmd) {
  console.error('Usage: node scripts/demo-db.cjs "<prisma command>"');
  process.exit(1);
}

const d = process.env.DEMO_DATABASE_URL;
const dd = process.env.DEMO_DIRECT_URL;
if (!d || !dd) {
  console.error("ABORT: DEMO_DATABASE_URL / DEMO_DIRECT_URL not set.");
  process.exit(1);
}
if (d === process.env.DATABASE_URL || dd === process.env.DIRECT_URL) {
  console.error("ABORT: demo connection equals production — refusing to run.");
  process.exit(1);
}

// Prisma commands and one-off scripts must verify real table/tenant state.
// Use the demo direct URL as DATABASE_URL so local operator checks do not fall
// back to DB-free plans when the pooled URL is unavailable.
process.env.DATABASE_URL = dd;
process.env.DIRECT_URL = dd;
try {
  console.log("Target DEMO host:", new URL(dd).host, "| pooled:", new URL(d).host);
} catch {}

const result = spawnSync(cmd, { stdio: "inherit", shell: true });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
