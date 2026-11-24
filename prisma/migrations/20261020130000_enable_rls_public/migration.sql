-- Enable Row Level Security on every table in the public schema (security, 2026-10-20).
--
-- Why: Supabase exposes the `public` schema through its Data API (PostgREST).
-- The app never uses that API — it connects directly through Prisma — but with
-- RLS off, anyone holding the project URL + the public (anon/publishable) key
-- could read or write every table through it. RLS ON with NO policies denies the
-- `anon` and `authenticated` API roles entirely.
--
-- Prisma is unaffected: it connects as the table owner (`postgres`), and table
-- owners bypass RLS unless FORCE ROW LEVEL SECURITY is set (it is not, here).
--
-- Idempotent. New tables added by later migrations do NOT inherit this —
-- run scripts/check-rls.ts after each migration (see the checklist in
-- docs/security/SECURITY-REVIEW-2026-10-20.md).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
