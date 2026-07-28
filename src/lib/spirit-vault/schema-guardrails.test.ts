import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guards the committed migration against silent drift of the defaults/constraints
// the review locked in. The migration is the source of truth applied to the DB,
// so these assert on its SQL text rather than a live connection.
const MIGRATION = readFileSync(
  join(process.cwd(), "prisma/migrations/20260728000000_add_spirit_vault/migration.sql"),
  "utf8",
);

describe("spirit-vault migration guardrails", () => {
  it("defaults SpiritDefinition.verificationStatus to UNSOURCED (fail-safe)", () => {
    expect(MIGRATION).toContain(
      `"verificationStatus" "SpiritVerificationStatus" NOT NULL DEFAULT 'UNSOURCED'`,
    );
    // and never silently promotes to partially-sourced via the DB default
    expect(MIGRATION).not.toContain(
      `"verificationStatus" "SpiritVerificationStatus" NOT NULL DEFAULT 'PARTIALLY_SOURCED'`,
    );
  });

  it("enforces the publicationStatus <= recordStatus invariant as a CHECK", () => {
    expect(MIGRATION).toContain('CHECK ("publicationStatus" <= "recordStatus")');
  });

  it("enforces body/finish 0–10 as CHECKs on the definition", () => {
    expect(MIGRATION).toContain('CHECK ("body" >= 0 AND "body" <= 10)');
    expect(MIGRATION).toContain('CHECK ("finish" >= 0 AND "finish" <= 10)');
  });

  it("keeps the composite tenant-agreement FKs (offer→venue, observation→offer)", () => {
    expect(MIGRATION).toContain(
      'FOREIGN KEY ("venueSpiritId", "restaurantId") REFERENCES "VenueSpirit"("id", "restaurantId")',
    );
    expect(MIGRATION).toContain(
      'FOREIGN KEY ("offerId", "restaurantId") REFERENCES "SpiritPour"("id", "restaurantId")',
    );
  });
});
