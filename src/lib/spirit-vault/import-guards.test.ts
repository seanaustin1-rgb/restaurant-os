import { describe, expect, it } from "vitest";
import {
  checkApplyGuards,
  checkPlanBaseline,
  parseTargetList,
  requiresEmptyTenant,
  type ApplyGuardInput,
  type BaselineInput,
} from "./import-guards";

const PROD_REF = "prodref1234567890";
const DEMO_REF = "demoref1234567890";

function nonProd(over: Partial<ApplyGuardInput> = {}): ApplyGuardInput {
  return {
    mode: "non-prod",
    targetToken: DEMO_REF,
    confirmTarget: DEMO_REF,
    allowedTargets: DEMO_REF,
    ...over,
  };
}

function prodSeed(over: Partial<ApplyGuardInput> = {}): ApplyGuardInput {
  return {
    mode: "production-seed",
    targetToken: PROD_REF,
    confirmTarget: PROD_REF,
    prodTarget: PROD_REF,
    ...over,
  };
}

function reasonOf(r: ReturnType<typeof checkApplyGuards>): string {
  return r.ok ? "" : r.reason;
}

describe("parseTargetList", () => {
  it("normalizes, trims and drops empties", () => {
    expect(parseTargetList(" A , b,, C ")).toEqual(["a", "b", "c"]);
  });

  it("treats unset as empty", () => {
    expect(parseTargetList(undefined)).toEqual([]);
    expect(parseTargetList("")).toEqual([]);
  });
});

describe("checkApplyGuards — shared", () => {
  it("refuses when the DATABASE_URL target cannot be determined", () => {
    for (const mode of ["non-prod", "production-seed"] as const) {
      const r = checkApplyGuards({ ...(mode === "non-prod" ? nonProd() : prodSeed()), targetToken: "  " });
      expect(r.ok).toBe(false);
      expect(reasonOf(r)).toMatch(/unverifiable database/);
    }
  });
});

describe("checkApplyGuards — non-prod mode", () => {
  it("passes when allowlisted and confirmed", () => {
    expect(checkApplyGuards(nonProd()).ok).toBe(true);
  });

  it("refuses under NODE_ENV=production", () => {
    const r = checkApplyGuards(nonProd({ nodeEnv: "production" }));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/NODE_ENV=production/);
  });

  it("refuses with an empty allowlist, and points at the seed mode instead", () => {
    const r = checkApplyGuards(nonProd({ allowedTargets: "" }));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/--production-seed/);
  });

  it("refuses a target that is not on the allowlist", () => {
    const r = checkApplyGuards(nonProd({ targetToken: PROD_REF, confirmTarget: PROD_REF }));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/NOT in the approved/);
  });

  it("refuses without a matching --confirm-target", () => {
    const missing = checkApplyGuards(nonProd({ confirmTarget: null }));
    expect(missing.ok).toBe(false);
    expect(reasonOf(missing)).toMatch(/--confirm-target/);

    const wrong = checkApplyGuards(nonProd({ confirmTarget: "something-else" }));
    expect(wrong.ok).toBe(false);
    expect(reasonOf(wrong)).toMatch(/--confirm-target/);
  });

  it("accepts case-insensitive refs", () => {
    const r = checkApplyGuards(
      nonProd({ targetToken: DEMO_REF.toUpperCase(), confirmTarget: DEMO_REF.toUpperCase() }),
    );
    expect(r.ok).toBe(true);
  });

  it("does NOT consult SPIRIT_VAULT_PROD_TARGET", () => {
    // A prod target set in the environment must not widen the everyday path.
    const r = checkApplyGuards(nonProd({ targetToken: PROD_REF, confirmTarget: PROD_REF, prodTarget: PROD_REF }));
    expect(r.ok).toBe(false);
  });
});

describe("checkApplyGuards — production-seed mode", () => {
  it("passes when the prod target, DATABASE_URL and confirmation all agree", () => {
    expect(checkApplyGuards(prodSeed()).ok).toBe(true);
  });

  it("refuses when SPIRIT_VAULT_PROD_TARGET is unset", () => {
    const r = checkApplyGuards(prodSeed({ prodTarget: undefined }));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/SPIRIT_VAULT_PROD_TARGET is not set/);
  });

  it("refuses when the prod target names more than one database", () => {
    const r = checkApplyGuards(prodSeed({ prodTarget: `${PROD_REF},${DEMO_REF}` }));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/exactly ONE target/);
  });

  it("refuses when the prod target does not match DATABASE_URL", () => {
    const r = checkApplyGuards(prodSeed({ targetToken: DEMO_REF, confirmTarget: DEMO_REF }));
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/does not match the/);
  });

  it("refuses without a matching --confirm-target", () => {
    const missing = checkApplyGuards(prodSeed({ confirmTarget: null }));
    expect(missing.ok).toBe(false);
    expect(reasonOf(missing)).toMatch(/--confirm-target/);

    const wrong = checkApplyGuards(prodSeed({ confirmTarget: DEMO_REF }));
    expect(wrong.ok).toBe(false);
  });

  it("does NOT accept approval from the non-prod allowlist", () => {
    // The whole point of a separate variable: SPIRIT_VAULT_ALLOWED_TARGETS must be
    // powerless here, so a prod ref pasted onto the everyday allowlist grants nothing.
    const r = checkApplyGuards(prodSeed({ prodTarget: undefined, allowedTargets: PROD_REF }));
    expect(r.ok).toBe(false);
  });

  it("is not blocked by NODE_ENV, which describes the process and not the database", () => {
    expect(checkApplyGuards(prodSeed({ nodeEnv: "production" })).ok).toBe(true);
  });

  it("requires an empty tenant; the non-prod path does not", () => {
    expect(requiresEmptyTenant("production-seed")).toBe(true);
    expect(requiresEmptyTenant("non-prod")).toBe(false);
  });
});

describe("checkPlanBaseline", () => {
  const clean: BaselineInput = {
    totals: { records: 110, published: 109 },
    validationFailures: [],
    duplicateKeys: [],
  };

  it("passes when the stated baseline matches the plan", () => {
    expect(checkPlanBaseline(clean, { records: 110, published: 109 }).ok).toBe(true);
  });

  it("accepts a different-sized shelf, so content growth does not wedge --apply", () => {
    const grown: BaselineInput = { ...clean, totals: { records: 148, published: 141 } };
    expect(checkPlanBaseline(grown, { records: 148, published: 141 }).ok).toBe(true);
  });

  it("refuses when either expectation is missing, and suggests the observed values", () => {
    const r = checkPlanBaseline(clean, { records: 110 });
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toContain("--expect-records=110");
    expect(reasonOf(r)).toContain("--expect-published=109");

    expect(checkPlanBaseline(clean, {}).ok).toBe(false);
  });

  it("refuses on a record or published mismatch", () => {
    const recs = checkPlanBaseline(clean, { records: 109, published: 109 });
    expect(recs.ok).toBe(false);
    expect(reasonOf(recs)).toMatch(/expected 109 records, got 110/);

    const pub = checkPlanBaseline(clean, { records: 110, published: 110 });
    expect(pub.ok).toBe(false);
    expect(reasonOf(pub)).toMatch(/expected 110 published, got 109/);
  });

  it("refuses on validation failures or duplicate keys even when the counts agree", () => {
    const bad: BaselineInput = { ...clean, validationFailures: [{}], duplicateKeys: [{}, {}] };
    const r = checkPlanBaseline(bad, { records: 110, published: 109 });
    expect(r.ok).toBe(false);
    expect(reasonOf(r)).toMatch(/1 validation failures/);
    expect(reasonOf(r)).toMatch(/2 duplicate keys/);
  });

  it("accepts zero as a stated expectation rather than treating it as missing", () => {
    const empty: BaselineInput = { ...clean, totals: { records: 0, published: 0 } };
    expect(checkPlanBaseline(empty, { records: 0, published: 0 }).ok).toBe(true);
  });
});
