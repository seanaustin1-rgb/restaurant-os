/**
 * Run a command against the SEPARATE demo database only.
 *
 * Remaps DEMO_DIRECT_URL onto DATABASE_URL / DIRECT_URL, and hard-aborts if the
 * demo URLs are missing, equal to the default URLs, or not a true direct
 * Supabase host. Spirit Vault apply uses an interactive transaction, so the
 * pooler is not safe for this operator path.
 *
 * Usage (loads .env.local for the DEMO_* vars):
 *   npx dotenv -e .env.local -- node scripts/demo-db.cjs "npx prisma migrate deploy"
 *   npx dotenv -e .env.local -- node scripts/demo-db.cjs "npx prisma db push"
 */
const { spawnSync } = require("child_process");

const cmd = process.argv[2];
if (!cmd) {
  console.error('Usage: node scripts/demo-db.cjs "<command>"');
  process.exit(1);
}

const pooledUrl = process.env.DEMO_DATABASE_URL;
const directUrl = process.env.DEMO_DIRECT_URL;
if (!pooledUrl || !directUrl) {
  console.error("ABORT: DEMO_DATABASE_URL / DEMO_DIRECT_URL not set.");
  process.exit(1);
}
if (pooledUrl === process.env.DATABASE_URL || directUrl === process.env.DIRECT_URL) {
  console.error("ABORT: demo connection equals default connection; refusing to run.");
  process.exit(1);
}

let pooledHost = "";
let directHost = "";
try {
  pooledHost = new URL(pooledUrl).host;
  directHost = new URL(directUrl).host;
} catch {
  console.error("ABORT: demo database URLs are not valid URLs.");
  process.exit(1);
}

if (!/^db\.[a-z0-9]+\.supabase\.co(?::5432)?$/i.test(directHost)) {
  console.error(
    "ABORT: DEMO_DIRECT_URL must be the Supabase direct host, not a pooler host.\n" +
      `Got: ${directHost}\n` +
      "Expected host shape: db.<project-ref>.supabase.co:5432\n" +
      "The Spirit Vault importer uses an interactive transaction; running it through the pooler can lose transaction state.",
  );
  process.exit(1);
}

// Prisma commands and one-off scripts must verify real table/tenant state.
// Use the demo direct URL as DATABASE_URL so operator checks do not fall back to
// DB-free plans when the pooled URL is unavailable.
process.env.DATABASE_URL = directUrl;
process.env.DIRECT_URL = directUrl;
console.log("Target DEMO host:", directHost, "| pooled:", pooledHost);

const result = spawnSync(cmd, { stdio: "inherit", shell: true });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
