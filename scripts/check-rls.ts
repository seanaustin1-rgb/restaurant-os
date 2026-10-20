/**
 * Read-only check: is Row Level Security enabled on every table in `public`?
 *
 * Run:  npx dotenv -e .env.local -o -- tsx scripts/check-rls.ts
 *
 * Supabase serves the `public` schema through its Data API. Any table with RLS
 * off is readable/writable by anyone holding the project URL + public key. The
 * app connects through Prisma as the table owner, so RLS-with-no-policies costs
 * it nothing. Migration 20261020130000_enable_rls_public turned RLS on for every
 * table that existed then; tables added by LATER migrations need it too — run
 * this after each migration and add an ENABLE ROW LEVEL SECURITY line for any
 * table it flags. Exits 1 if any table is unprotected. Never writes.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`
    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  const off = rows.filter((r) => !r.rowsecurity);
  console.log(`public tables: ${rows.length} · RLS on: ${rows.length - off.length} · RLS OFF: ${off.length}`);
  for (const r of off) console.log(`  ✗ ${r.tablename}`);
  if (off.length > 0) {
    console.log("\nFix: ALTER TABLE public.\"<table>\" ENABLE ROW LEVEL SECURITY;  (in a new migration)");
    process.exitCode = 1;
  } else {
    console.log("✓ every public table has RLS enabled");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
