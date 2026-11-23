# One-time Spirit Vault demo-to-production copy

## Status and scope

This is a prepared operator script, not an executed migration. **It has not been
run against either database, even in dry-run mode. No production credentials
were read or used to develop or test it.**

Sean reports that the spirit data is in `outfront-demo` and production has zero
rows in its Spirit tables. **UNVERIFIED here:** live row counts, restaurant IDs,
schema parity, permissions, target constraints/triggers/RLS, connectivity, and
real database execution/rollback. Offline tests and code review are not live
database verification.

Fixed direction:

- SOURCE_URL: `outfront-demo`, project `jzjscsoasfjsxekyfrgi`.
- TARGET_URL: production, project `rweclputxgwutykinlbr`.
- Both restaurant arguments are required, including for a dry run. The two
  Restaurant rows must already exist. The script does not create tenants.
- Use direct PostgreSQL connections or Supabase session-pooler connections on
  port 5432. Transaction-pooler connections on port 6543 are rejected.
- The script reads only SOURCE_URL and TARGET_URL. It does not load `.env.local`
  or use DATABASE_URL, DIRECT_URL, or the application's Prisma singleton.

Copied in foreign-key order:

| Table | Scope / behavior |
| --- | --- |
| SpiritDefinition | Entire catalog, all columns and timestamps preserved; upsert by id, with slug identity checks |
| VenueSpirit | Only the selected source restaurant; restaurantId remapped |
| SpiritPour | Only the selected source restaurant; restaurantId remapped |
| SpiritPriceObservation | Same scope/remapping; preserve IDs and append-only history; conflicting existing observations abort |
| SpiritFlight | Same scope/remapping; preserve flight IDs, status and pricing snapshot |
| SpiritFlightItem | Same scope/remapping; preserve parent IDs, order and notes |
| CustomFlightTemplate | Explicitly supported when present; if source has selected rows but target table is missing, refuse the copy |

All other tables are excluded. GuestProfile, GuestMembership, MembershipCode,
MembershipRedemption, guest/tasting/passport tables, and test/demo tables are
never copied. The report prints source counts for excluded tables whose names
identify them as spirit/flight/guest/membership/redemption/code/test/demo/seed
data; the remaining non-allowlisted tables are explicitly reported as skipped
as a group. There is deliberately no `--include` option: adding sensitive tables
requires a separate explicit instruction and reviewed code change.

Rows for other source restaurants are counted as skipped. Target-only rows are
retained. Draft/published statuses and venue voice are copied unchanged; the
script does not publish drafts or fabricate content. Toast identifiers, cached
prices and synchronization timestamps are preserved, **not** verified against
the production venue's POS. Confirm the intended source restaurant really is
the collection for the target venue before applying.

## Find the restaurant IDs

Open each project's Supabase Dashboard separately and run this **read-only**
query in the SQL Editor (or inspect the Restaurant table):

```sql
SELECT id, name, slug FROM public."Restaurant" ORDER BY name, id;
```

In `outfront-demo`, inspect which restaurants actually have listings:

```sql
SELECT r.id, r.name, r.slug, count(v.id) AS venue_spirits
FROM public."Restaurant" r
LEFT JOIN public."VenueSpirit" v ON v."restaurantId" = r.id
GROUP BY r.id, r.name, r.slug
ORDER BY venue_spirits DESC, r.name;
```

Choose the source restaurant that owns the intended Vault and the existing
production restaurant for the real venue. Do not infer IDs from matching names
or use a historical ID without checking it. Restaurant creation, staff-role
setup and migrations are separate operator tasks.

## Operator procedure (future execution only)

1. Review the PR, schema and table list. Take a target database backup. The script
   refuses enabled user-defined triggers on copied target tables; they require
   separate review before changing this policy. Internal FK triggers are allowed.
2. Set SOURCE_URL and TARGET_URL in your shell using the connection strings
   for the named projects. Do not put credentials in commands, committed files,
   screenshots, logs, or PR comments. Prefer a read-only source role.
3. Run the default dry run, or make the mode explicit:

```powershell
npx.cmd tsx scripts/one-off/copy-spirits-demo-to-prod.ts --source-restaurant=<verified-demo-id> --target-restaurant=<verified-prod-id> --dry-run
```

The report contains per-table projected insert/update/skip counts, schema and
foreign-key gaps, and identity/unique-key conflicts. Failure is a nonzero exit;
there is no fabricated DB-free success report. Dry-run transactions on **both**
connections are READ ONLY. Missing required tables, schema drift, missing
parents or either missing Restaurant row prevent applying.
The script sets transaction-local `row_security = off` to fail if RLS would
silently filter rows. It does not grant bypass privileges or change policies;
use a suitably authorized operator connection.

4. Resolve every gap/conflict and review the counts. If CustomFlightTemplate
   needs a target migration, review/apply that separately. This script never
   executes DDL or reconciles migration histories.
5. Only after separate human approval to write production, run:

```powershell
npx.cmd tsx scripts/one-off/copy-spirits-demo-to-prod.ts --source-restaurant=<verified-demo-id> --target-restaurant=<verified-prod-id> --apply
```

Apply reads a consistent, read-only source snapshot. Target planning and **all
writes** happen in one serializable transaction with copy-table locks. An error
rolls back every target write; there is no partial-table commit, automatic retry,
delete/reinsert strategy, or batch commit. The preflight report is projected;
only the final `COMMITTED` message confirms success. Transactions have a two-minute
timeout, which is **UNVERIFIED** for the live dataset's size.

Upserts preserve source IDs. Existing target IDs owned by another restaurant,
slugs/natural keys attached to different IDs, and changes to immutable price
observations cause refusal. Unique-key swaps between existing rows also require
separate review rather than destructive reconciliation.

6. Rerun the dry run: identical selected rows should all be skipped. Check guest
   rendering, flight order, prices, and staff access separately before launch.

The script logs no URLs, passwords, guest records or driver diagnostics. On a
database error it emits a sanitized failure. If diagnosis is necessary, inspect
the database's authorized operator logs rather than adding credentials to output.

## Review and tests

Offline tests exercise direction/argument guards, dry-run/no-write behavior,
stable IDs, tenant remapping, conflicts, schema gaps, foreign keys, idempotency,
append-only observations, parameterized SQL and SQL-NULL/JSON-null preservation.
The database adapter and single-transaction CLI flow have been inspected in code.
**UNVERIFIED:** actual PostgreSQL metadata queries, JSON row casting, locking,
transaction isolation and rollback against the two live databases.
