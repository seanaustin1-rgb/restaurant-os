import type { NoteAudience, UserRole } from "@prisma/client";

/**
 * Metric-note access control — the single, tested source of truth for who can
 * read and write dated "managed event" notes, and which notes an investor is
 * allowed to see.
 *
 * The core correctness concern: an INTERNAL note ("laid off 3 staff", "missed a
 * debt payment") must NEVER reach an investor. Visibility is enforced here and
 * applied on every server read/write (see the metric-notes server actions) —
 * hiding a button in the UI is not access control.
 */

// Roles permitted to author / edit notes. Investors are strictly read-only; an
// investor must never be able to write a note, and specifically never able to
// promote one to INVESTOR-visible.
export const NOTE_WRITER_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

export function canWriteMetricNotes(role: UserRole | null | undefined): boolean {
  return role != null && (NOTE_WRITER_ROLES as readonly string[]).includes(role);
}

// The set of audiences a given viewer role may READ. This is the leak guard:
// an INVESTOR resolves to INVESTOR-only; a writer sees everything; a user with
// no role on the tenant sees nothing.
export function readableAudiencesFor(role: UserRole | null | undefined): NoteAudience[] {
  if (role === "INVESTOR") return ["INVESTOR"];
  if (canWriteMetricNotes(role)) return ["INTERNAL", "INVESTOR"];
  return [];
}

export function canReadAudience(role: UserRole | null | undefined, audience: NoteAudience): boolean {
  return readableAudiencesFor(role).includes(audience);
}

// Normalize an arbitrary client-supplied audience to a valid enum value,
// defaulting to the safe (INTERNAL) side. Never trust the raw string on a write.
export function normalizeAudience(value: unknown): NoteAudience {
  return value === "INVESTOR" ? "INVESTOR" : "INTERNAL";
}
