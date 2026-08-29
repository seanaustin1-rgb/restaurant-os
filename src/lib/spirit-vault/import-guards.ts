/**
 * Pure guard decisions for `scripts/import-spirit-vault.ts`.
 *
 * The importer is the only code path that creates SpiritDefinition / VenueSpirit /
 * SpiritPour rows, so the question "is this write allowed against THIS database?"
 * is the highest-consequence decision in the Spirit Vault. It lives here, free of
 * `process.env` and Prisma, so it can be tested exhaustively — the script reads env
 * and the DB, then asks these functions.
 *
 * Two apply modes, deliberately separate:
 *
 *   • "non-prod"        — the original path. SPIRIT_VAULT_ALLOWED_TARGETS is the
 *                         authority and it is a NON-production allowlist.
 *   • "production-seed" — a one-shot seed of an EMPTY tenant in production, gated on
 *                         a differently-named env var (SPIRIT_VAULT_PROD_TARGET) so a
 *                         prod ref can never sneak onto the non-prod allowlist, and on
 *                         the tenant having zero VenueSpirit rows (checked by the
 *                         caller against the DB — see requiresEmptyTenant).
 *
 * The invariant both modes share: the approving value is sourced INDEPENDENTLY of
 * DATABASE_URL, so a database can never authorize itself by echoing its own ref.
 */

export type ApplyMode = "non-prod" | "production-seed";

export type GuardResult = { ok: true } | { ok: false; reason: string };

const OK: GuardResult = { ok: true };

/** Parse a comma-separated env allowlist into normalized refs. */
export function parseTargetList(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface ApplyGuardInput {
  mode: ApplyMode;
  /** Ref derived from DATABASE_URL by the caller. */
  targetToken: string;
  /** Value of --confirm-target, or null when the flag was omitted. */
  confirmTarget: string | null;
  /** process.env.NODE_ENV */
  nodeEnv?: string;
  /** Raw SPIRIT_VAULT_ALLOWED_TARGETS (non-prod mode). */
  allowedTargets?: string;
  /** Raw SPIRIT_VAULT_PROD_TARGET (production-seed mode). */
  prodTarget?: string;
}

/**
 * Whether this mode additionally requires the tenant to have zero VenueSpirit rows.
 * The caller must check that against the DB — a seed may never overwrite curated
 * production data, and the empty-tenant precondition is what makes "seed" honest.
 */
export function requiresEmptyTenant(mode: ApplyMode): boolean {
  return mode === "production-seed";
}

/** Every target-approval guard for an --apply, in one decision. */
export function checkApplyGuards(input: ApplyGuardInput): GuardResult {
  const target = input.targetToken.trim().toLowerCase();
  if (!target) {
    return {
      ok: false,
      reason:
        "Cannot determine the DATABASE_URL target — refusing to write to an unverifiable database.",
    };
  }

  const confirm = input.confirmTarget?.trim().toLowerCase() ?? null;

  if (input.mode === "production-seed") {
    // NODE_ENV is NOT consulted here. It describes the process, never the database,
    // and a production seed is legitimately run from an operator machine where
    // NODE_ENV is unset. SPIRIT_VAULT_PROD_TARGET is the authority instead.
    const prod = (input.prodTarget ?? "").trim().toLowerCase();
    if (!prod) {
      return {
        ok: false,
        reason:
          "Refusing to seed production: SPIRIT_VAULT_PROD_TARGET is not set.\n" +
          "Set it to the production project ref you intend to seed. It is deliberately a\n" +
          "DIFFERENT variable from SPIRIT_VAULT_ALLOWED_TARGETS (which is non-prod only), so a\n" +
          "production ref can never be approved by the everyday allowlist.",
      };
    }
    if (parseTargetList(prod).length > 1) {
      return {
        ok: false,
        reason:
          "Refusing to seed production: SPIRIT_VAULT_PROD_TARGET must name exactly ONE target.\n" +
          "A production seed is a single, deliberate act against a single database.",
      };
    }
    if (prod !== target) {
      return {
        ok: false,
        reason:
          `Refusing to seed production: SPIRIT_VAULT_PROD_TARGET ("${prod}") does not match the\n` +
          `DATABASE_URL target ("${target}"). One of the two is pointed at the wrong database.`,
      };
    }
    if (confirm !== target) {
      return {
        ok: false,
        reason: `Refusing to seed production: also pass --confirm-target=${target} to acknowledge THIS database.`,
      };
    }
    return OK;
  }

  // ── non-prod mode (the everyday path) ──
  if (input.nodeEnv === "production") {
    return { ok: false, reason: "Refusing to apply with NODE_ENV=production." };
  }

  const allowlist = parseTargetList(input.allowedTargets);
  if (allowlist.length === 0) {
    return {
      ok: false,
      reason:
        "Refusing to apply: no approved non-production targets configured.\n" +
        "Set SPIRIT_VAULT_ALLOWED_TARGETS to the approved non-prod project ref(s) — the #137\n" +
        "migration was applied to `outfront-demo`, so set it to that project's ref (comma-separated\n" +
        "for multiple). This allowlist is deliberately NOT derived from DATABASE_URL.\n" +
        "(Seeding an empty PRODUCTION tenant is a different, narrower operation: --production-seed.)",
    };
  }
  if (!allowlist.includes(target)) {
    return {
      ok: false,
      reason:
        `Refusing to apply: DATABASE_URL target "${target}" is NOT in the approved\n` +
        `non-production allowlist [${allowlist.join(", ")}]. Point at an approved DB or fix the allowlist.`,
    };
  }
  if (confirm !== target) {
    return {
      ok: false,
      reason: `Refusing to apply: also pass --confirm-target=${target} to acknowledge THIS database.`,
    };
  }
  return OK;
}

/** The subset of an ImportPlan the baseline check needs. */
export interface BaselineInput {
  totals: { records: number; published: number };
  validationFailures: readonly unknown[];
  duplicateKeys: readonly unknown[];
}

export interface BaselineExpectation {
  /** --expect-records=N */
  records?: number;
  /** --expect-published=N */
  published?: number;
}

/**
 * The operator must state the baseline they believe they are importing, and the plan
 * must match it exactly. This replaces a hardcoded 110/109, which wedged --apply on
 * every content change; the safety it provided (you cannot apply a plan you have not
 * looked at) is preserved by REQUIRING both numbers rather than defaulting them.
 */
export function checkPlanBaseline(plan: BaselineInput, expected: BaselineExpectation): GuardResult {
  const problems: string[] = [];

  if (expected.records == null || expected.published == null) {
    return {
      ok: false,
      reason:
        "Refusing to apply: state the baseline you are importing.\n" +
        `Pass --expect-records=${plan.totals.records} --expect-published=${plan.totals.published} ` +
        "(the values this plan plans right now).\n" +
        "They are required so an --apply can never import a record set nobody looked at.",
    };
  }

  if (plan.totals.records !== expected.records) {
    problems.push(`expected ${expected.records} records, got ${plan.totals.records}`);
  }
  if (plan.totals.published !== expected.published) {
    problems.push(`expected ${expected.published} published, got ${plan.totals.published}`);
  }
  if (plan.validationFailures.length) {
    problems.push(`expected 0 validation failures, got ${plan.validationFailures.length}`);
  }
  if (plan.duplicateKeys.length) {
    problems.push(`expected 0 duplicate keys, got ${plan.duplicateKeys.length}`);
  }

  if (problems.length) {
    return {
      ok: false,
      reason:
        "Plan does not match the stated baseline — refusing to apply:\n" +
        problems.map((p) => `  • ${p}`).join("\n") +
        "\n\n(Dry-run only prints; --apply stays blocked until the plan and the stated baseline agree.)",
    };
  }
  return OK;
}
