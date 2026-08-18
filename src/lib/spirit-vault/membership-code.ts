import { createHash, randomInt } from "crypto";

// Membership access codes. The plaintext code is shown to the admin exactly ONCE at
// generation and never stored — only its hash and a safe display hint are persisted,
// so a database leak can't reveal working codes (they're also high-entropy). Redemption
// hashes the submitted code and looks it up by hash. Tenant-scoping is enforced by the
// caller (restaurantId), not encoded in the code.

// Crockford-style alphabet, ambiguous glyphs (0/1/O/I) removed.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEFAULT_PREFIX = "RSRV";
const GROUP_LEN = 4;
const GROUP_COUNT = 2;

/** Uppercase and keep only alphanumerics, so redemption tolerates spaces/dashes/case. */
export function normalizeMembershipCode(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function pepper(): string {
  // Optional server pepper — hardens hashes against a DB-only leak. Codes are already
  // high-entropy, so SHA-256 alone is sufficient; the pepper is defense in depth.
  // NOTE: changing this env value invalidates every existing code.
  return process.env.SPIRIT_VAULT_MEMBERSHIP_PEPPER?.trim() ?? "";
}

/** Deterministic storage/lookup hash for a code. */
export function hashMembershipCode(plaintext: string): string {
  return createHash("sha256").update(`${pepper()}:${normalizeMembershipCode(plaintext)}`).digest("hex");
}

function randomGroup(): string {
  let s = "";
  for (let i = 0; i < GROUP_LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export interface GeneratedCode {
  /** Show ONCE, then discard — never persist this. */
  plaintext: string;
  /** Persist this. */
  codeHash: string;
  /** Safe to persist and display in lists (reveals nothing usable). */
  hint: string;
}

/**
 * Generate a fresh code, e.g. `RSRV-7K2Q-9M4X`. `prefix` is cosmetic/branding only
 * (defaulted, overridable per venue) — it carries no tenancy or secret.
 */
export function generateMembershipCode(prefix: string = DEFAULT_PREFIX): GeneratedCode {
  const groups = Array.from({ length: GROUP_COUNT }, randomGroup);
  const plaintext = [prefix, ...groups].join("-");
  return {
    plaintext,
    codeHash: hashMembershipCode(plaintext),
    hint: `${prefix}·${groups[0]}·••••`,
  };
}
