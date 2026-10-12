/** Offline planning for the one-time copy. This module never opens a database. */
export const COPY_TABLES = [
  "SpiritDefinition", "VenueSpirit", "SpiritPour", "SpiritPriceObservation",
  "SpiritFlight", "SpiritFlightItem", "CustomFlightTemplate",
] as const;
export type CopyTable = typeof COPY_TABLES[number];
export type Row = Record<string, unknown> & { id: string };
export interface Column { name: string; type: string; nullable: boolean; }
export interface ForeignKey { columns: string[]; table: string; referencedColumns: string[]; }
export interface TableSnapshot {
  columns: Column[];
  uniqueKeys: string[][];
  foreignKeys: ForeignKey[];
  rows: Row[];
  total: number;
}
export type Snapshot = Partial<Record<CopyTable, TableSnapshot>>;
export interface CopyOptions { sourceRestaurant: string; targetRestaurant: string; apply: boolean; }
export interface TablePlan {
  table: CopyTable;
  inserted: number;
  updated: number;
  skipped: number;
  columns: Column[];
  writes: { action: "insert" | "update"; row: Row }[];
}
export interface CopyPlan { tables: TablePlan[]; gaps: string[]; conflicts: string[]; }

export function parseCopyArgs(args: string[]): CopyOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "--apply" || token === "--dry-run") {
      if (flags.has(token)) throw new Error(`Duplicate option ${token}`);
      flags.add(token);
      continue;
    }
    const match = /^(--source-restaurant|--target-restaurant)(?:=(.*))?$/.exec(token);
    if (!match) throw new Error("Unknown argument. Only restaurant IDs, --dry-run and --apply are supported.");
    const value = match[2] ?? args[++i];
    if (!value?.trim() || value.startsWith("--")) throw new Error(`Missing value for ${match[1]}`);
    if (values.has(match[1])) throw new Error(`Duplicate option ${match[1]}`);
    values.set(match[1], value.trim());
  }
  if (flags.has("--apply") && flags.has("--dry-run")) throw new Error("Choose --apply OR --dry-run.");
  const sourceRestaurant = values.get("--source-restaurant");
  const targetRestaurant = values.get("--target-restaurant");
  if (!sourceRestaurant || !targetRestaurant) throw new Error("Both --source-restaurant and --target-restaurant are required.");
  return { sourceRestaurant, targetRestaurant, apply: flags.has("--apply") };
}

/** Reject reversed/ambiguous connections before constructing either client. */
export function validateCopyUrls(source: string | undefined, target: string | undefined): { source: string; target: string } {
  function verify(raw: string | undefined, label: string, expected: string): string {
    if (!raw) throw new Error(`${label} is required.`);
    let url: URL;
    try { url = new URL(raw); } catch { throw new Error(`${label} must be a PostgreSQL connection URL.`); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/postgres") {
      throw new Error(`${label} must address the postgres database using PostgreSQL.`);
    }
    const direct = url.hostname === `db.${expected}.supabase.co`;
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
      && decodeURIComponent(url.username) === `postgres.${expected}`;
    if (!direct && !pooler) throw new Error(`${label} does not identify the required Supabase project ${expected}.`);
    if (pooler && url.port !== "5432") throw new Error(`${label}: use a direct connection or session pooler on port 5432, not transaction pooling.`);
    return raw;
  }
  return {
    source: verify(source, "SOURCE_URL", "jzjscsoasfjsxekyfrgi"),
    target: verify(target, "TARGET_URL", "rweclputxgwutykinlbr"),
  };
}

export function normalizedJson(value: unknown): string {
  function normalize(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;
    if ("toJSON" in v && typeof v.toJSON === "function") return normalize(v.toJSON());
    if (Array.isArray(v)) return v.map(normalize);
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, normalize(x)]));
  }
  return JSON.stringify(normalize(value));
}

function key(row: Record<string, unknown>, columns: string[]): string | null {
  const values = columns.map((column) => row[column]);
  // PostgreSQL UNIQUE and MATCH SIMPLE foreign keys allow nulls.
  return values.some((v) => v == null) ? null : normalizedJson(values);
}

export async function planSpiritCopy(
  source: Snapshot, target: Snapshot, options: CopyOptions,
  externalReferenceExists: (fk: ForeignKey, values: Record<string, unknown>) => Promise<boolean>,
): Promise<CopyPlan> {
  const plan: CopyPlan = { tables: [], gaps: [], conflicts: [] };
  const finalRows = new Map<string, Row[]>();
  for (const table of COPY_TABLES) {
    const from = source[table];
    const into = target[table];
    const p: TablePlan = { table, inserted: 0, updated: 0, skipped: from ? from.total - from.rows.length : 0, columns: [], writes: [] };
    plan.tables.push(p);
    if (!from) {
      if (table !== "CustomFlightTemplate") plan.gaps.push(`${table}: source table is missing.`);
      if (into) finalRows.set(table, into.rows);
      continue;
    }
    if (!into) {
      if (table !== "CustomFlightTemplate" || from.rows.length > 0) plan.gaps.push(`${table}: target table is missing; apply migrations separately.`);
      continue;
    }
    if (normalizedJson(from.columns) !== normalizedJson(into.columns)
      || normalizedJson(from.uniqueKeys) !== normalizedJson(into.uniqueKeys)
      || normalizedJson(from.foreignKeys) !== normalizedJson(into.foreignKeys)) {
      plan.gaps.push(`${table}: source/target columns, unique keys or foreign keys differ.`);
      continue;
    }
    p.columns = from.columns;
    const existing = new Map(into.rows.map((row) => [row.id, row]));
    const merged = new Map(existing);
    const sourceIds = new Set<string>();
    for (const original of from.rows) {
      if (sourceIds.has(original.id)) { plan.conflicts.push(`${table}/${original.id}: duplicate source ID.`); continue; }
      sourceIds.add(original.id);
      if (table !== "SpiritDefinition" && original.restaurantId !== options.sourceRestaurant) {
        plan.conflicts.push(`${table}/${original.id}: unexpected source restaurant.`); continue;
      }
      const row: Row = table === "SpiritDefinition" ? { ...original } : { ...original, restaurantId: options.targetRestaurant };
      const prior = existing.get(row.id);
      if (prior && table !== "SpiritDefinition" && prior.restaurantId !== options.targetRestaurant) {
        plan.conflicts.push(`${table}/${row.id}: ID belongs to another target restaurant.`); continue;
      }
      if (prior && table === "SpiritDefinition" && prior.slug !== row.slug) {
        plan.conflicts.push(`${table}/${row.id}: existing ID has a different slug.`); continue;
      }
      if (prior && normalizedJson(prior) === normalizedJson(row)) { p.skipped++; continue; }
      if (prior && table === "SpiritPriceObservation") {
        plan.conflicts.push(`${table}/${row.id}: existing append-only observation differs.`); continue;
      }
      p.writes.push({ action: prior ? "update" : "insert", row });
      if (prior) p.updated++; else p.inserted++;
      merged.set(row.id, row);
    }
    // Refuse natural-key collisions rather than silently changing IDs or deleting
    // target data. Also refuse key swaps that cannot be upserted row-by-row.
    for (const columns of from.uniqueKeys) {
      const occupied = new Map<string, string>();
      for (const row of into.rows) {
        const k = key(row, columns);
        if (k !== null) occupied.set(k, row.id);
      }
      for (const { row } of p.writes) {
        const k = key(row, columns);
        if (k === null) continue;
        const owner = occupied.get(k);
        if (owner && owner !== row.id) plan.conflicts.push(`${table}/${row.id}: unique key (${columns.join(", ")}) belongs to another ID.`);
        occupied.set(k, row.id);
      }
    }
    finalRows.set(table, [...merged.values()]);
  }
  for (const p of plan.tables) {
    const from = source[p.table];
    if (!from || !target[p.table] || !p.columns.length) continue;
    // Check all selected rows, including unchanged rows, against the post-copy
    // state. Composite restaurant keys are checked together, never by ID alone.
    for (const original of from.rows) {
      const row = p.table === "SpiritDefinition" ? original : { ...original, restaurantId: options.targetRestaurant };
      for (const fk of from.foreignKeys) {
        const k = key(row, fk.columns);
        if (k === null) continue;
        const values = Object.fromEntries(fk.referencedColumns.map((column, i) => [column, row[fk.columns[i]]]));
        const copied = finalRows.get(fk.table);
        const found = copied
          ? copied.some((parent) => key(parent, fk.referencedColumns) === k)
          : await externalReferenceExists(fk, values);
        if (!found) plan.gaps.push(`${p.table}/${row.id}: missing ${fk.table} reference (${fk.columns.join(", ")}).`);
      }
    }
  }
  return plan;
}

export interface CopyWriter { upsert(table: CopyTable, columns: Column[], row: Row): Promise<void>; }

/** Caller must construct the apply plan inside this same target transaction. */
export async function writeSpiritCopy(plan: CopyPlan, writer: CopyWriter): Promise<void> {
  if (plan.gaps.length || plan.conflicts.length) throw new Error("Copy refused: resolve every foreign-key/schema gap and conflict first.");
  for (const p of plan.tables) for (const { row } of p.writes) await writer.upsert(p.table, p.columns, row);
}

/** Used by the CLI after planning, and testable without starting the CLI. */
export async function finishSpiritCopy(plan: CopyPlan, writer: CopyWriter, apply: boolean): Promise<void> {
  if (plan.gaps.length || plan.conflicts.length) throw new Error("Preflight failed; no rows were copied.");
  if (apply) await writeSpiritCopy(plan, writer);
}
