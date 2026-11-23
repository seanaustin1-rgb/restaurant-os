import type { Prisma } from "@prisma/client";
import {
  COPY_TABLES, normalizedJson,
  type Column, type CopyTable, type ForeignKey, type Row, type Snapshot,
} from "../../src/lib/spirit-vault/copy-spirits";

type Db = Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe">;
export function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Unsupported database identifier.");
  return `"${value}"`;
}
function relation(table: string): string { return `public.${identifier(table)}`; }

export async function publicTables(db: Db): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ table_name: string }[]>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
  );
  return rows.map((row) => row.table_name);
}

async function schema(db: Db, table: CopyTable) {
  const name = relation(table);
  const columns = await db.$queryRawUnsafe<Column[]>(`
    SELECT a.attname::text AS name, pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
      NOT a.attnotnull AS nullable
    FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY a.attname`, name);
  const unsupported = await db.$queryRawUnsafe<{ count: number }[]>(`
    SELECT count(*)::int AS count FROM pg_index
    WHERE indrelid=$1::regclass AND indisunique AND (indpred IS NOT NULL OR indexprs IS NOT NULL)`, name);
  if (unsupported[0].count) throw new Error(`${table}: expression/partial unique indexes need manual review.`);
  const indexes = await db.$queryRawUnsafe<{ columns: string[] }[]>(`
    SELECT array_agg(a.attname::text ORDER BY k.ordinality) AS columns
    FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
    WHERE i.indrelid=$1::regclass AND i.indisunique AND k.ordinality<=i.indnkeyatts
    GROUP BY i.indexrelid`, name);
  const uniqueKeys = indexes.map((index) => index.columns).sort((a, b) => normalizedJson(a).localeCompare(normalizedJson(b)));
  const foreignKeys = await db.$queryRawUnsafe<(ForeignKey & { schema: string })[]>(`
    SELECT n.nspname::text AS schema, r.relname::text AS "table",
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,pos)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.pos) AS columns,
      ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,pos)
        JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.pos) AS "referencedColumns"
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.confrelid JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE c.conrelid=$1::regclass AND c.contype='f'`, name);
  if (foreignKeys.some((fk) => fk.schema !== "public")) throw new Error(`${table}: cross-schema foreign key needs manual review.`);
  return {
    columns, uniqueKeys,
    foreignKeys: foreignKeys.map(({ schema: _schema, ...fk }) => fk)
      .sort((a, b) => normalizedJson(a).localeCompare(normalizedJson(b))),
  };
}

export async function readSnapshot(db: Db, tables: string[], restaurantId?: string): Promise<Snapshot> {
  const snapshot: Snapshot = {};
  for (const table of COPY_TABLES) {
    if (!tables.includes(table)) continue;
    const meta = await schema(db, table);
    const scope = restaurantId && table !== "SpiritDefinition";
    // JSON columns travel as PostgreSQL text: JS null alone cannot distinguish
    // SQL NULL from JSON null. Preserve both, including nullable overrides.
    const fields = meta.columns.map((column) => ["json", "jsonb"].includes(column.type)
      ? `${identifier(column.name)}::text AS ${identifier(column.name)}` : identifier(column.name)).join(", ");
    const rows = await db.$queryRawUnsafe<Row[]>(
      `SELECT ${fields} FROM ${relation(table)}${scope ? ' WHERE "restaurantId"=$1' : ""} ORDER BY id`,
      ...(scope ? [restaurantId] : []),
    );
    const count = await db.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int AS count FROM ${relation(table)}`);
    snapshot[table] = { ...meta, rows, total: count[0].count };
  }
  return snapshot;
}

export async function referenceExists(db: Db, fk: ForeignKey, values: Record<string, unknown>): Promise<boolean> {
  const name = relation(fk.table);
  const match = fk.referencedColumns.map((column) => `existing.${identifier(column)}=incoming.${identifier(column)}`).join(" AND ");
  const rows = await db.$queryRawUnsafe<{ found: boolean }[]>(`
    SELECT EXISTS(SELECT 1 FROM ${name} existing
      CROSS JOIN jsonb_populate_record(NULL::${name},$1::jsonb) incoming WHERE ${match}) AS found`, normalizedJson(values));
  return rows[0].found;
}

export async function skippedTables(db: Db, tables: string[]): Promise<{ table: string; skipped: number }[]> {
  const skipped = [];
  for (const table of tables) {
    if ((COPY_TABLES as readonly string[]).includes(table)) continue;
    // Count only; never select guest records, hashes, redemption data or codes.
    if (!/spirit|flight|guest|membership|redemption|code|test|demo|seed/i.test(table)) continue;
    const rows = await db.$queryRawUnsafe<{ count: number }[]>(`SELECT count(*)::int AS count FROM ${relation(table)}`);
    skipped.push({ table, skipped: rows[0].count });
  }
  return skipped;
}

export async function upsertRow(db: Db, table: CopyTable, columns: Column[], row: Row): Promise<void> {
  if (!(COPY_TABLES as readonly string[]).includes(table)) throw new Error("Table is not on the copy allowlist.");
  const name = relation(table);
  const fields = columns.map((column) => identifier(column.name)).join(", ");
  const selected = columns.map((column) => ["json", "jsonb"].includes(column.type)
    ? `($1::jsonb->>'${column.name}')::${column.type}` : `incoming.${identifier(column.name)}`).join(", ");
  const updates = columns.filter((column) => column.name !== "id").map((column) => `${identifier(column.name)}=EXCLUDED.${identifier(column.name)}`).join(", ");
  // PostgreSQL casts fields through the real row type. JSON text is decoded
  // separately so SQL NULL and JSON null are not collapsed.
  await db.$executeRawUnsafe(`INSERT INTO ${name} (${fields})
    SELECT ${selected} FROM jsonb_populate_record(NULL::${name},$1::jsonb) incoming
    ON CONFLICT (id) DO UPDATE SET ${updates}`, normalizedJson(row));
}

export async function lockCopyTables(db: Db, tables: string[]): Promise<void> {
  const present = COPY_TABLES.filter((table) => tables.includes(table));
  if (present.length) await db.$executeRawUnsafe(`LOCK TABLE ${present.map(relation).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
}

export async function targetTriggerGaps(db: Db, tables: string[]): Promise<string[]> {
  const gaps: string[] = [];
  for (const table of COPY_TABLES.filter((name) => tables.includes(name))) {
    const rows = await db.$queryRawUnsafe<{ count: number }[]>(`
      SELECT count(*)::int AS count FROM pg_trigger WHERE tgrelid=$1::regclass
      AND NOT tgisinternal AND tgenabled<>'D'`, relation(table));
    if (rows[0].count) gaps.push(`${table}: enabled user trigger(s) require separate review; refusing side effects on excluded tables or timestamps.`);
  }
  return gaps;
}
