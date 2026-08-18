import { createHmac, timingSafeEqual } from "crypto";

// Deterministic per-venue, per-day access code for the Spirit Vault "physical
// presence" gate. The code is a pure function of (venue secret, venue-local date,
// tenant), so it is the same all day and any day's placemat can be reprinted
// identically, yet nobody can compute tomorrow's code without the secret. No DB,
// no cron. When SPIRIT_VAULT_DAY_SECRET is unset the gate is DISABLED (fail-open)
// so shipping this never locks the live vault before the secret is configured.
//
// FUTURE (paid tier): off-premise access becomes a paid entitlement — the gate is
// resolved as `validDayCode OR memberHasOffPremiseEntitlement`, so keep the
// day-code path here free of any "hard wall" assumptions.

// Crockford-style alphabet with the ambiguous glyphs (0/1/O/I) removed, so a code
// read off a printed placemat can't be mistyped into a different valid code.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LEN = 6;
const DEFAULT_TZ = "America/New_York";

export function venueTimeZone(): string {
  return process.env.SPIRIT_VAULT_TZ?.trim() || DEFAULT_TZ;
}

function daySecret(): string | null {
  return process.env.SPIRIT_VAULT_DAY_SECRET?.trim() || null;
}

/** The gate only enforces once a secret is configured. */
export function dayGateEnabled(): boolean {
  return daySecret() !== null;
}

/** YYYY-MM-DD for the given instant in the venue's local time. */
export function venueDateKey(now: Date = new Date(), tz: string = venueTimeZone()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Deterministic code for a specific venue-local date. `secret`/`tenant` default to
 * env (SPIRIT_VAULT_DAY_SECRET / SPIRIT_VAULT_RESTAURANT_ID) but are injectable for
 * tests and future multi-venue use. Throws if no secret is available.
 */
export function dayCodeFor(dateKey: string, opts: { secret?: string; tenant?: string } = {}): string {
  const secret = opts.secret ?? daySecret();
  if (!secret) throw new Error("SPIRIT_VAULT_DAY_SECRET is not set");
  const tenant = opts.tenant ?? process.env.SPIRIT_VAULT_RESTAURANT_ID?.trim() ?? "";
  const mac = createHmac("sha256", secret).update(`${tenant}:${dateKey}`).digest();
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[mac[i] % ALPHABET.length];
  return out;
}

/** Today's code in the venue timezone. Throws if no secret is configured. */
export function todayCode(now: Date = new Date()): string {
  return dayCodeFor(venueDateKey(now));
}

/** Uppercase and drop any glyphs not in the alphabet (spaces, hyphens, typos). */
export function normalizeCode(raw: string): string {
  return (raw || "")
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
}

/** Constant-time compare of a provided code against today's code. */
export function isValidDayCode(provided: string | null | undefined, now: Date = new Date()): boolean {
  if (!provided || !dayGateEnabled()) return false;
  const a = Buffer.from(normalizeCode(provided));
  const b = Buffer.from(todayCode(now));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Seconds until the next venue-local midnight — used for the access cookie's lifetime. */
export function secondsUntilVenueMidnight(now: Date = new Date(), tz: string = venueTimeZone()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = get("hour");
  if (h === 24) h = 0; // some ICU builds report 24 at midnight
  const secondsSinceMidnight = h * 3600 + get("minute") * 60 + get("second");
  return Math.max(60, 86400 - secondsSinceMidnight);
}

const CANONICAL_BASE_URL = "https://www.outfrontdata.com";

/**
 * Canonical app origin for absolute links (QR targets). No trailing slash.
 * Guard: a QR is printed ink — if NEXT_PUBLIC_APP_URL resolves to a localhost/loopback
 * value (dev default, or a misconfigured prod env), fall back to the canonical domain
 * so a placemat can never carry a dead localhost link. Runtime redirects self-correct;
 * a printed QR cannot.
 */
export function appBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL?.trim() || CANONICAL_BASE_URL).replace(/\/+$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(raw)) return CANONICAL_BASE_URL;
  return raw;
}

/**
 * Absolute URL to encode in a placemat QR. When the gate is enabled it routes
 * through the day-code entry (/v/<code>?to=…); otherwise it links straight to the
 * destination so the QR is still useful before the gate is switched on.
 */
export function qrTargetUrl(toPath: string, now: Date = new Date()): string {
  const base = appBaseUrl();
  const safeTo = toPath.startsWith("/") ? toPath : `/${toPath}`;
  if (!dayGateEnabled()) return `${base}${safeTo}`;
  return `${base}/v/${todayCode(now)}?to=${encodeURIComponent(safeTo)}`;
}
