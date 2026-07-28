// Load the rendered guest records from the static vault, in Node — server/
// script-only (reads repo files; never imported by a page/client bundle).
//
// The canonical data lives in docs/spirit-vault/spirit-vault-data.js as a
// browser IIFE (window.SPIRIT_VAULT_DATA({ makeBatchSpirit })), and the two
// engine helpers it depends on (makeBatchSpirit, formatMoney) live inline in
// spirit-vault-prototype.html — there is no build step for the static vault, so
// they are not yet a shared module. Rather than fork that logic (which the
// handoff forbids), we extract those two functions from the HTML and evaluate
// the data file against them, reproducing exactly what a guest's browser builds.
//
// This is the importer's read side; extracting the engine into a shared
// spirit-vault-engine.js that both the HTML and this loader consume is a clean
// follow-up that removes the extraction step.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GuestRecord } from "./transform";

const VAULT_DIR = join(process.cwd(), "docs", "spirit-vault");

/** Extract a top-level `function NAME(...) { ... }` by brace-balancing. */
function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`spirit-vault loader: function ${name} not found`);
  let depth = 0;
  let began = false;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") {
      depth++;
      began = true;
    } else if (src[j] === "}") {
      depth--;
      if (began && depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`spirit-vault loader: unbalanced braces for ${name}`);
}

/**
 * Reconstruct every guest record (5 legacy + the makeBatchSpirit batch) exactly
 * as the browser renders them. Returns the raw record array.
 */
export function loadGuestRecords(vaultDir: string = VAULT_DIR): GuestRecord[] {
  const html = readFileSync(join(vaultDir, "spirit-vault-prototype.html"), "utf8");
  const dataJs = readFileSync(join(vaultDir, "spirit-vault-data.js"), "utf8");

  const formatMoneySrc = extractFunction(html, "formatMoney");
  const makeBatchSrc = extractFunction(html, "makeBatchSpirit");

  // eslint-disable-next-line no-new-func -- controlled eval of first-party repo
  // source in a script/test context; input is our own committed files, never
  // user input, and this module is never bundled into a client/page.
  const runner = new Function(`
    ${formatMoneySrc}
    ${makeBatchSrc}
    var window = {};
    ${dataJs}
    return window.SPIRIT_VAULT_DATA({ makeBatchSpirit: makeBatchSpirit });
  `);

  const records = runner() as GuestRecord[];
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("spirit-vault loader: no records reconstructed");
  }
  return records;
}
