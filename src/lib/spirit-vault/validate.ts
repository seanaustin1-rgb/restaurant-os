// Spirit Vault — publish-time validator (the merge gate).
//
// Pure and deterministic (same philosophy as src/lib/dashboard/signals.ts): no
// I/O, no DB, no clock. It answers one question — "is this spirit safe to make
// guest-visible?" — and is reused by three callers that must agree:
//   • the importer (before staging the 108 existing dossiers),
//   • the admin editor (before flipping a record to published),
//   • the publish/export step (before a row is written into the static guest
//     vault, spirit-vault-data.js).
//
// The schema was split into shared knowledge (SpiritDefinition, objective) vs.
// tenant listing (VenueSpirit) vs. offers (SpiritPour). This gate now validates
// the COMPOSED publishable unit — a definition + a venue listing + its pours —
// because guest-visibility is a property of that whole composition, not of any
// one row.
//
// It mirrors the guest engine's runtime gate (isGuestVisible needs BOTH
// recordStatus AND publicationStatus === published) and the DB CHECK constraints
// (publicationStatus <= recordStatus, body/finish in 0–10), and adds the richer
// content rules the DB can't express (topNotes exactly 3, one primary pour, a
// priced primary pour, the 7 flavor axes). The DB checks are the backstop; this
// is the friendly, complete gate that runs first.

import type { SpiritLifecycleStatus } from "@prisma/client";

/** The seven flavor axes the radar renders; each scored 0–10. */
export const FLAVOR_AXES = [
  "Sweet",
  "Oak",
  "Spice",
  "Fruit",
  "Smoke",
  "Earth",
  "Herbal",
] as const;
export type FlavorAxis = (typeof FLAVOR_AXES)[number];

/** Lifecycle ordering — DRAFT < REVIEWED < PUBLISHED (matches enum declaration
 *  order in schema.prisma and the Postgres enum CHECK on the table). */
const LIFECYCLE_RANK: Record<SpiritLifecycleStatus, number> = {
  DRAFT: 0,
  REVIEWED: 1,
  PUBLISHED: 2,
};

export function lifecycleRank(status: SpiritLifecycleStatus): number {
  return LIFECYCLE_RANK[status];
}

/** The shared, objective knowledge fields the gate inspects. A subset of the
 *  Prisma SpiritDefinition row so it can validate an in-memory draft. */
export interface SpiritDefinitionInput {
  slug?: string | null;
  brand?: string | null;
  category?: string | null;
  body?: number | null;
  finish?: number | null;
  topNotes?: string[] | null;
  whyShort?: string | null;
  flavor?: Record<string, unknown> | null;
}

/** The tenant listing fields the gate inspects. A subset of the Prisma
 *  VenueSpirit row. Both lifecycle statuses are required (they default in the
 *  DB, so any persisted or draft row always has them). */
export interface VenueSpiritInput {
  slug?: string | null;
  recordStatus: SpiritLifecycleStatus;
  publicationStatus: SpiritLifecycleStatus;
}

/** A pour offer, as validated pre-insert or on a persisted row. */
export interface SpiritPourInput {
  pourSizeOz?: number | null;
  priceUsd?: number | null;
  isPrimary?: boolean | null;
}

/** The composed publishable unit: shared definition + tenant listing + offers. */
export interface PublishableSpiritInput {
  definition: SpiritDefinitionInput;
  venueSpirit: VenueSpiritInput;
  offers: SpiritPourInput[];
}

export interface SpiritValidationError {
  field: string;
  message: string;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isBlank(v: string | null | undefined): boolean {
  return v == null || v.trim() === "";
}

function isIntInRange(v: number | null | undefined, lo: number, hi: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
}

/**
 * Validate a composed publishable spirit (definition + venue listing + offers).
 * Returns every problem found — an empty array means it passes. Invariants that
 * always hold (status ordering, body/finish range, slug shape, per-offer sanity)
 * are checked for any record; the richer content rules apply only when the
 * record is being made guest-visible (publicationStatus === PUBLISHED).
 */
export function validatePublishableSpirit(
  input: PublishableSpiritInput,
): SpiritValidationError[] {
  const { definition, venueSpirit, offers } = input;
  const errors: SpiritValidationError[] = [];
  const push = (field: string, message: string) => errors.push({ field, message });

  // ── Always-on invariants (mirror the DB CHECK constraints) ──
  if (lifecycleRank(venueSpirit.publicationStatus) > lifecycleRank(venueSpirit.recordStatus)) {
    push(
      "publicationStatus",
      `publicationStatus (${venueSpirit.publicationStatus}) may not exceed recordStatus (${venueSpirit.recordStatus})`,
    );
  }
  if (definition.body != null && !isIntInRange(definition.body, 0, 10)) {
    push("body", "body must be an integer 0–10");
  }
  if (definition.finish != null && !isIntInRange(definition.finish, 0, 10)) {
    push("finish", "finish must be an integer 0–10");
  }

  if (isBlank(venueSpirit.slug)) {
    push("venueSpirit.slug", "venueSpirit slug is required");
  } else if (!SLUG_RE.test(venueSpirit.slug!.trim())) {
    push("venueSpirit.slug", "venueSpirit slug must be lowercase, hyphen-separated (e.g. penelope-barrel-strength)");
  }
  if (isBlank(definition.slug)) {
    push("definition.slug", "definition slug is required");
  } else if (!SLUG_RE.test(definition.slug!.trim())) {
    push("definition.slug", "definition slug must be lowercase, hyphen-separated (e.g. penelope-barrel-strength)");
  }

  if (isBlank(definition.brand)) push("brand", "brand is required");
  if (isBlank(definition.category)) push("category", "category is required");

  // An offer may claim primary at most once, regardless of publication state.
  const primaryCount = offers.filter((p) => p.isPrimary === true).length;
  for (const [i, p] of offers.entries()) {
    if (p.pourSizeOz != null && !(p.pourSizeOz > 0)) {
      push(`offers[${i}].pourSizeOz`, "pourSizeOz must be greater than 0");
    }
    if (p.priceUsd != null && p.priceUsd < 0) {
      push(`offers[${i}].priceUsd`, "priceUsd may not be negative");
    }
  }
  if (primaryCount > 1) {
    push("offers", `exactly one offer may be primary; found ${primaryCount}`);
  }

  // ── Guest-visibility rules (only when publishing) ──
  if (venueSpirit.publicationStatus === "PUBLISHED") {
    if (venueSpirit.recordStatus !== "PUBLISHED") {
      // Redundant with the ordering check above, but stated explicitly because
      // the guest gate needs BOTH to be PUBLISHED, not merely well-ordered.
      push("recordStatus", "a guest-visible spirit must also have recordStatus PUBLISHED");
    }

    const notes = definition.topNotes ?? [];
    if (notes.length !== 3 || notes.some(isBlank)) {
      push("topNotes", "a published spirit needs exactly 3 non-empty topNotes");
    }

    if (isBlank(definition.whyShort)) {
      push("whyShort", "a published spirit needs a whyShort (above-the-fold sentence)");
    }

    const flavor = definition.flavor ?? {};
    for (const axis of FLAVOR_AXES) {
      const v = flavor[axis];
      if (typeof v !== "number" || !isIntInRange(v, 0, 10)) {
        push("flavor", `flavor.${axis} must be an integer 0–10`);
      }
    }

    if (offers.length === 0) {
      push("offers", "a published spirit needs at least one offer");
    } else if (primaryCount !== 1) {
      push("offers", `a published spirit needs exactly one primary offer; found ${primaryCount}`);
    } else {
      const primary = offers.find((p) => p.isPrimary === true)!;
      if (primary.priceUsd == null) {
        push("offers", "the primary offer of a published spirit needs a price");
      }
    }
  }

  return errors;
}

/** Convenience boolean form. */
export function isSpiritPublishable(input: PublishableSpiritInput): boolean {
  return validatePublishableSpirit(input).length === 0;
}
