/**
 * Builds the guest-vault data payload from `BeverageItem` rows.
 *
 * The static guest vault ships a `spirit-vault-data.js` that defines
 * `window.SPIRIT_VAULT_DATA(...)` returning an array of records the inline engine
 * normalizes + renders. The dynamic `/vault` route serves the SAME engine HTML but
 * swaps that script for a payload generated here from the database — so there is no
 * renderer rewrite and no fragile regenerate-and-git-publish step.
 *
 * Each row carries the full normalized record in `knowledge` (stored at import); we
 * overlay the editable typed columns (Sean's voice, flavor, status, commerce) on top
 * so admin edits win. Emitting full record objects is exactly what the engine's five
 * LEGACY records already do, so the engine consumes them unchanged.
 */

// Structurally-typed input so this works with real Prisma `BeverageItem` rows AND
// the plain rows the import script/tests produce (Decimal vs number tolerated).
export interface VaultItemInput {
  id: string;
  cat: string;
  name: string;
  style?: string | null;
  proofN?: number | null;
  proofDisplay?: string | null;
  ageText?: string | null;
  flavor?: unknown;
  body?: number | null;
  finish?: number | null;
  topNotes?: unknown;
  whyWeCarry?: string | null;
  seanShort?: string | null;
  notes?: string | null;
  pairings?: unknown;
  paths?: unknown;
  pourPriceUsd?: number | { toString(): string } | null;
  pourSizeOz?: number | { toString(): string } | null;
  toastItemGuid?: string | null;
  availability?: string | null;
  recordStatus: string;
  publicationStatus: string;
  verificationStatus: string;
  knowledge?: unknown;
}

const PENDING = "Pending Sean review.";
const num = (v: unknown): number | null =>
  v == null ? null : typeof v === "number" ? v : Number((v as { toString(): string }).toString());
const lower = (s: string) => s.toLowerCase();

function priceDisplay(usd: number | null, fallback: unknown): string {
  if (usd == null) return typeof fallback === "string" ? fallback : "Pending";
  const s = usd.toFixed(2).replace(/\.00$/, "");
  return `$${s}`;
}

/** One BeverageItem row → the record shape the engine consumes (full object). */
export function itemToVaultRecord(item: VaultItemInput): Record<string, unknown> {
  const base = (item.knowledge && typeof item.knowledge === "object" ? { ...(item.knowledge as object) } : {}) as Record<
    string,
    unknown
  >;
  const price = num(item.pourPriceUsd);

  const rec: Record<string, unknown> = { ...base };
  // identity / taxonomy (authoritative from columns)
  rec.id = item.id;
  rec.cat = item.cat;
  rec.name = item.name;
  if (item.style != null) rec.style = item.style;
  // strength — numeric proof wins the hero tile; label only when proofN is null
  if (item.proofN != null) {
    rec.proofN = item.proofN;
    rec.proof = String(item.proofN);
  } else if (item.proofDisplay) {
    rec.proofN = null;
    rec.proof = item.proofDisplay;
  }
  if (item.ageText != null) rec.age = item.ageText;
  // flavor / structure
  if (item.flavor) rec.flavor = item.flavor;
  if (item.body != null) rec.body = item.body;
  if (item.finish != null) rec.finish = item.finish;
  if (item.topNotes) rec.topNotes = item.topNotes;
  // Sean's voice — null column → placeholder so the engine's hide-when-placeholder
  // logic keeps the drawer/cue hidden (never leaks "Pending Sean review." to guests)
  rec.whyWeCarry = item.whyWeCarry ?? PENDING;
  rec.seanShort = item.seanShort ?? PENDING;
  rec.notes = item.notes ?? PENDING;
  if (item.pairings) rec.pairings = item.pairings;
  if (item.paths) rec.paths = item.paths;
  // commerce (Toast-owned snapshot)
  rec.commerce = {
    ...((base.commerce as object) ?? {}),
    pourPriceUsd: price,
    pourSizeOz: num(item.pourSizeOz) ?? 2,
    toastItemGuid: item.toastItemGuid ?? null,
    availability: item.availability ?? null,
  };
  rec.price = priceDisplay(price, base.price);
  // lifecycle (lowercased back to the engine's vocabulary; gate re-runs client-side)
  rec.recordStatus = lower(item.recordStatus);
  rec.publicationStatus = lower(item.publicationStatus);
  rec.verificationStatus = lower(item.verificationStatus).replace(/_/g, "-");
  return rec;
}

/** Serialize published rows into the `window.SPIRIT_VAULT_DATA` script body. */
export function buildVaultPayloadScript(items: VaultItemInput[]): string {
  const records = items.map(itemToVaultRecord);
  // The engine calls SPIRIT_VAULT_DATA({makeBatchSpirit}); we return full objects and
  // ignore the factory arg (same as the LEGACY records do).
  return `window.SPIRIT_VAULT_DATA = function(){ return ${JSON.stringify(records)}; };`;
}
