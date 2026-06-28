/**
 * Menu-pricer agent — shows how to give an agent a CUSTOM TOOL.
 *
 * Defines an in-process `break_even` tool (real TS function the model can call)
 * and lets the agent use it to answer pricing/margin questions. Demonstrates the
 * tool() + createSdkMcpServer() pattern from the SDK.
 *
 * Run:   npx tsx scripts/agents/menu-pricer.ts "fixed costs are 139000, margin 65%"
 * or:    npm run agent:menu -- "fixed costs are 139000, margin 65%"
 */
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { runAgent, assertAuth } from "./_shared";

// A real function the agent can invoke. Replace the body with a DB/Prisma call
// to compute from live data instead of args.
const breakEven = tool(
  "break_even",
  "Compute monthly break-even revenue from fixed costs and contribution margin %.",
  { fixedMonthly: z.number(), contributionMarginPct: z.number() },
  async ({ fixedMonthly, contributionMarginPct }) => {
    const be = fixedMonthly / (contributionMarginPct / 100);
    return {
      content: [
        {
          type: "text",
          text: `Break-even = $${fixedMonthly.toLocaleString()} / ${contributionMarginPct}% = $${be.toLocaleString(
            undefined,
            { maximumFractionDigits: 0 }
          )}/mo`,
        },
      ],
    };
  }
);

const tools = createSdkMcpServer({
  name: "restaurant-tools",
  version: "1.0.0",
  tools: [breakEven],
});

async function main() {
  assertAuth();

  const question =
    process.argv.slice(2).join(" ").trim() ||
    "If fixed costs are $139,000/mo and contribution margin is 65%, what's break-even? Use the break_even tool.";

  console.log(`\n[menu-pricer] ${question}\n${"-".repeat(60)}`);

  await runAgent(question, {
    systemPrompt:
      "You are a menu pricing analyst. Use the break_even tool for any break-even math; show the result clearly.",
    mcpServers: { "restaurant-tools": tools },
    // Allow the custom tool. SDK MCP tools are namespaced mcp__<server>__<tool>.
    allowedTools: ["mcp__restaurant-tools__break_even"],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
