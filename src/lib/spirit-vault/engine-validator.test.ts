import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGuestRecords } from "./load-guest-records";

// The guest engine runs its OWN record validator at startup
// (spirit-vault-prototype.html: `validateSpiritRecords(ALL_BOTTLES)`), and until
// this file existed nothing in the test suite exercised it. That gap is how a
// real bug shipped green: every draft-inventory record carries `reviewedAt: null`,
// the validator's blank check had no draft exemption, and so opening the
// prototype over file:// or localhost threw before rendering a single bottle —
// while `npm test` stayed 100% passing the whole time. (Caught by Codex on #145.)
//
// The engine's dev-mode throw is deliberately invisible in production
// (`if(isDev) throw`; production only console.errors), which makes a green test
// suite the only place this can be caught before someone opens the file locally.
//
// This runs the REAL validator source — extracted, not reimplemented — over the
// REAL corpus, exactly as the browser does: normalizeSpiritRecords, then validate.

const VAULT_DIR = join(process.cwd(), "docs", "spirit-vault");

/**
 * Extract the engine's validation layer verbatim: from the first shared constant
 * through the end of `validateSpiritRecords`, stopping before the DOM-dependent
 * code that follows. Reimplementing any of it here would defeat the purpose —
 * the point is to catch drift between the engine and the data.
 */
function loadEngineValidator(): {
  normalizeSpiritRecords: (records: unknown[]) => unknown[];
  validateSpiritRecords: (records: unknown[]) => void;
  collectErrors: (records: unknown[]) => string[];
} {
  const html = readFileSync(join(VAULT_DIR, "spirit-vault-prototype.html"), "utf8");

  const start = html.indexOf("const SPIRIT_DATA_VERSION");
  const end = html.indexOf("const REVIEW_MODE");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("engine-validator test: could not locate the validation layer in the prototype");
  }
  const engineSrc = html.slice(start, end);

  // `validateSpiritRecords` ends by consulting `location` to decide whether to
  // throw. Stub it as a non-dev host so the function returns its errors to us
  // instead of throwing, and capture what it logged.
  // eslint-disable-next-line no-new-func -- controlled eval of first-party repo
  // source in a test context; never bundled into a client/page.
  const factory = new Function(`
    const location = { protocol: 'https:', hostname: 'www.outfrontdata.com' };
    let __lastErrors = [];
    const console = { error: (_msg, errs) => { __lastErrors = errs || []; } };
    ${engineSrc}
    return {
      normalizeSpiritRecords,
      validateSpiritRecords,
      collectErrors: (records) => { __lastErrors = []; validateSpiritRecords(records); return __lastErrors; },
    };
  `);
  return factory();
}

const engine = loadEngineValidator();
const bottles = engine.normalizeSpiritRecords(loadGuestRecords() as unknown[]);

describe("the guest engine's own validator accepts the shipped corpus", () => {
  it("produces zero validation errors for all 200 records", () => {
    const errors = engine.collectErrors(bottles);
    // Print them all on failure — the engine reports one string per problem.
    expect(errors, errors.slice(0, 20).join("\n")).toHaveLength(0);
  });

  it("does not throw when the prototype is opened locally", () => {
    // Reproduces the dev path (`location.protocol === 'file:'`), which is where
    // the engine escalates validation errors into a hard throw.
    const html = readFileSync(join(VAULT_DIR, "spirit-vault-prototype.html"), "utf8");
    const engineSrc = html.slice(
      html.indexOf("const SPIRIT_DATA_VERSION"),
      html.indexOf("const REVIEW_MODE"),
    );
    // eslint-disable-next-line no-new-func -- see loadEngineValidator
    const runLocally = new Function(
      "records",
      `
      const location = { protocol: 'file:', hostname: '' };
      const console = { error: () => {} };
      ${engineSrc}
      validateSpiritRecords(records);
    `,
    );
    expect(() => runLocally(bottles)).not.toThrow();
  });
});

describe("draft-optional fields stay exempt only for drafts", () => {
  it("lets a draft omit reviewedAt and topNotes", () => {
    const draft = (bottles as any[]).find((b) => b.recordStatus === "draft" && b.reviewedAt === null);
    expect(draft, "corpus should still contain an unreviewed draft").toBeTruthy();
    expect(engine.collectErrors([draft])).toHaveLength(0);
  });

  it("still requires them of a published record", () => {
    const published = (bottles as any[]).find(
      (b) => b.recordStatus === "published" && b.publicationStatus === "published",
    );
    expect(published, "corpus should still contain a published record").toBeTruthy();

    const stripped = { ...published, reviewedAt: null, topNotes: null };
    const errors = engine.collectErrors([stripped]);
    expect(errors.join("\n")).toContain('missing required field "reviewedAt"');
    expect(errors.join("\n")).toContain('missing required field "topNotes"');
  });
});
