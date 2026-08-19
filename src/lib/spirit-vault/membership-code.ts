import { createHmac, randomInt } from "crypto";

// Membership access codes. The plaintext code is shown to the admin exactly ONCE at
// generation and never stored — only its hash and a safe display hint are persisted,
// so a database leak can't reveal working codes. Codes are HMAC-keyed with a REQUIRED
// server secret (pepper): without the secret an attacker can't brute-force a leaked
// hash offline, and the code body is long enough (12 chars, ~2^60) that even without
// the key it is infeasible. Tenant-scoping is enforced by the caller (restaurantId).

// Crockford-style alphabet, ambiguous glyphs (0/1/O/I) removed.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEFAULT_PREFIX = "RSRV";
const GROUP_LEN = 4;
const GROUP_COUNT = 3; // 12 random chars ≈ 2^60 — infeasible to brute-force

/** Uppercase and keep only alphanumerics, so redemption tolerates spaces/dashes/case. */
export function normalizeMembershipCode(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Required server secret (HMAC key). Membership codes cannot be generated or verified
 * without it — fail-closed. Set SPIRIT_VAULT_MEMBERSHIP_PEPPER in the environment.
 * NOTE: changing this value invalidates every existing code.
 */
function pepper(): string {
  const p = process.env.SPIRIT_VAULT_MEMBERSHIP_PEPPER?.trim();
  if (!p) throw new Error("SPIRIT_VAULT_MEMBERSHIP_PEPPER is required to generate or verify membership codes");
  return p;
}

/** Keyed storage/lookup hash for a code (HMAC-SHA256 under the server secret). */
export function hashMembershipCode(plaintext: string): string {
  return createHmac("sha256", pepper()).update(normalizeMembershipCode(plaintext)).digest("hex");
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
 * Generate a fresh code, e.g. `RSRV-7K2Q-9M4X-3PQ2`. `prefix` is cosmetic/branding
 * only (defaulted, overridable per venue) — it carries no tenancy or secret.
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
