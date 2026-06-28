/**
 * Cash-analyst agent — a read-only example.
 *
 * Reads the repo to answer a cash-flow / Profit-First question, showing its
 * reasoning and the files it relied on. It can search and read code but cannot
 * edit anything (READ_ONLY_TOOLS).
 *
 * Run:   npx tsx scripts/agents/cash-analyst.ts "your question here"
 * or:    npm run agent:cash -- "your question here"
 */
import { runAgent, assertAuth, READ_ONLY_TOOLS } from "./_shared";

const SYSTEM_PROMPT = `You are a restaurant cash-flow analyst for the OutFront Data / Restaurant OS codebase.
Principles:
- Surface the signal and SHOW THE MATH; never overclaim.
- When you cite a number or rule, point to the file it came from (path:line).
- If the data isn't in the repo, say so plainly instead of guessing.`;

async function main() {
  assertAuth();

  const question =
    process.argv.slice(2).join(" ").trim() ||
    "Find where break-even is calculated in this repo and explain the formula in plain English, citing the file.";

  console.log(`\n[cash-analyst] ${question}\n${"-".repeat(60)}`);

  await runAgent(question, {
    systemPrompt: SYSTEM_PROMPT,
    allowedTools: [...READ_ONLY_TOOLS],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
