// End-to-end verification harness for the Tier-3 statement import pipeline.
// Run with: npx dotenv -e .env.local -o -- tsx scripts/test-llm-extract.ts
//
// Exercises the SAME logic the HTTP routes use, without the dev server / Clerk:
//   1. extractTransactionsWithLLMDetailed()  (the LLM extractor + token usage)
//   2. /api/import mapping: credit -> negative amount, debit -> positive
//   3. /api/import/commit: categorizeTransaction() + synthetic plaidTxnId dedup
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import type { LlmTxn } from "../src/lib/import/llm-extract";
import { extractTransactionsWithLLMDetailed, llmExtractionAvailable } from "../src/lib/import/llm-extract";
import { categorizeTransaction } from "../src/lib/categorization/vendor-map";

const FRESH = process.argv.includes("--fresh"); // force a new (paid) extraction
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const PDF_PATH = positional[0] || "C:\\Users\\Default_50\\Downloads\\Statement (7).pdf";
const FAKE_RID = "test-restaurant"; // stand-in for role.restaurantId in the commit route
const CACHE = "scripts/.cache-txns.json"; // cached extraction so categorization re-tests are free

// Sonnet 4.6 list pricing ($ per 1M tokens). Adjust if you switch models.
const PRICING: Record<string, { in: number; cacheWrite: number; cacheRead: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, cacheWrite: 3.75, cacheRead: 0.3, out: 15 },
  "claude-opus-4-8": { in: 15, cacheWrite: 18.75, cacheRead: 1.5, out: 75 },
  "claude-haiku-4-5": { in: 1, cacheWrite: 1.25, cacheRead: 0.1, out: 5 },
};

async function main() {
  const model = process.env.STATEMENT_EXTRACT_MODEL || "claude-opus-4-8";
  console.log("Model:", model, "| Key available:", llmExtractionAvailable());
  console.log("PDF:", PDF_PATH);

  console.log(`\n=== EXTRACTION ===`);
  let txns: LlmTxn[];
  if (!FRESH && existsSync(CACHE)) {
    txns = JSON.parse(readFileSync(CACHE, "utf8")) as LlmTxn[];
    console.log(`Loaded ${txns.length} transactions from cache (${CACHE}). Use --fresh to re-extract.`);
  } else {
    const bytes = readFileSync(PDF_PATH);
    const t0 = process.hrtime.bigint();
    const { transactions, usage } = await extractTransactionsWithLLMDetailed(new Uint8Array(bytes));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    txns = transactions;
    writeFileSync(CACHE, JSON.stringify(txns, null, 2));
    console.log(`Extracted ${txns.length} transactions in ${ms.toFixed(0)} ms (cached to ${CACHE})`);

    // ---- Cost ----
    const u = usage as any;
    const inTok = u.input_tokens ?? 0;
    const cw = u.cache_creation_input_tokens ?? 0;
    const cr = u.cache_read_input_tokens ?? 0;
    const outTok = u.output_tokens ?? 0;
    const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
    const cost = (inTok * p.in + cw * p.cacheWrite + cr * p.cacheRead + outTok * p.out) / 1e6;
    console.log(`Tokens: input=${inTok} cacheWrite=${cw} cacheRead=${cr} output=${outTok}`);
    console.log(`Est. cost @ ${model}: $${cost.toFixed(4)} per statement`);
  }

  // ---- /api/import mapping (credit -> negative, debit -> positive) ----
  const candidates = txns.map((t) => ({
    date: t.date,
    description: t.description,
    amount: t.direction === "credit" ? -Math.abs(t.amount) : Math.abs(t.amount),
  }));

  // ---- /api/import/commit: categorize + dedup ----
  const byBucket: Record<string, { count: number; total: number }> = {};
  const uncategorized: Record<string, { count: number; total: number }> = {};
  const seenIds = new Map<string, number>();
  let collisions = 0;

  for (const t of candidates) {
    // Mirror the commit route: inflows (deposits) -> REVENUE, else vendor rules.
    const cat =
      t.amount < 0
        ? { bucket: "REVENUE", isRecurring: false, confidence: 0.9 }
        : categorizeTransaction(null, t.description);
    const b = byBucket[cat.bucket] ?? { count: 0, total: 0 };
    b.count++; b.total += t.amount; byBucket[cat.bucket] = b;

    if (cat.bucket === "UNCATEGORIZED") {
      // Group uncategorized by a normalized vendor key (first 22 chars) to rank gaps.
      const key = t.description.replace(/\d{2,}/g, "#").replace(/\s+/g, " ").trim().slice(0, 28);
      const g = uncategorized[key] ?? { count: 0, total: 0 };
      g.count++; g.total += Math.abs(t.amount); uncategorized[key] = g;
    }

    const hash = createHash("sha1").update(`${t.date}|${t.amount}|${t.description}`).digest("hex").slice(0, 16);
    const id = `stmt-${FAKE_RID}-${hash}`;
    seenIds.set(id, (seenIds.get(id) ?? 0) + 1);
    if ((seenIds.get(id) ?? 0) > 1) collisions++;
  }

  console.log(`\n=== CATEGORIZATION (real vendor-map) ===`);
  const total = candidates.length;
  const catd = total - (byBucket["UNCATEGORIZED"]?.count ?? 0);
  console.log(`Categorized: ${catd}/${total} (${((catd / total) * 100).toFixed(0)}%)`);
  for (const [bucket, v] of Object.entries(byBucket).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${bucket.padEnd(16)} ${String(v.count).padStart(4)} rows   $${v.total.toFixed(2)}`);
  }

  console.log(`\n=== TOP UNCATEGORIZED GAPS (by $ outflow) ===`);
  Object.entries(uncategorized)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 18)
    .forEach(([k, v]) => console.log(`  ${k.padEnd(30)} ${String(v.count).padStart(3)}x  $${v.total.toFixed(2)}`));

  console.log(`\n=== DEDUP (synthetic plaidTxnId) ===`);
  console.log(`Unique IDs: ${seenIds.size}/${total}`);
  console.log(`Collisions (rows that would be SILENTLY DROPPED on import): ${collisions}`);
  if (collisions > 0) {
    console.log("  Colliding (date|amount|description) groups:");
    for (const [id, n] of seenIds) {
      if (n > 1) {
        const ex = candidates.find(
          (t) => `stmt-${FAKE_RID}-${createHash("sha1").update(`${t.date}|${t.amount}|${t.description}`).digest("hex").slice(0, 16)}` === id,
        );
        console.log(`    ${n}x  ${ex?.date}  $${ex?.amount}  ${ex?.description?.slice(0, 50)}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
