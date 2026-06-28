/**
 * Shared config + runner for Claude Agent SDK agents.
 *
 * Every agent in this folder imports `runAgent` and a base options object,
 * so they share one place to tune model, permissions, and tool access.
 *
 * Auth: relies on the CLAUDE_CODE_OAUTH_TOKEN env var (subscription token,
 * minted via `npx @anthropic-ai/claude-code setup-token`). No API key needed.
 *
 * Run any agent with: npx tsx scripts/agents/<name>.ts
 */
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

/** Sensible defaults shared by every agent. Override per-agent as needed. */
export const baseOptions: Options = {
  model: "claude-opus-4-8",
  // Run agents against the repo root they were launched from.
  cwd: process.cwd(),
  // Load the repo's CLAUDE.md + .claude/settings.json so agents inherit project rules.
  settingSources: ["project"],
  // Prompt before anything risky. Use "acceptEdits" for write-agents you trust,
  // or "bypassPermissions" for fully autonomous runs (careful).
  permissionMode: "default",
  // A hard ceiling so a runaway agent can't loop forever.
  maxTurns: 20,
};

/** Read-only toolset: agents that analyze but never mutate the repo. */
export const READ_ONLY_TOOLS = ["Read", "Grep", "Glob"] as const;

/** Pull plain text out of an assistant message's content blocks. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b): b is { type: "text"; text: string } => b?.type === "text")
      .map((b) => b.text)
      .join("");
  }
  return "";
}

/**
 * Run an agent to completion: stream its turns to the console and return the
 * final result text. Merge `baseOptions` with anything you pass in.
 */
export async function runAgent(
  prompt: string,
  options: Partial<Options> = {}
): Promise<string> {
  let finalText = "";
  for await (const msg of query({
    prompt,
    options: { ...baseOptions, ...options },
  })) {
    if (msg.type === "assistant") {
      const t = textOf(msg.message.content);
      if (t.trim()) process.stdout.write(t + "\n");
    } else if (msg.type === "result") {
      finalText = "result" in msg ? String(msg.result ?? "") : "";
    }
  }
  return finalText;
}

/** Guard so agents fail loudly if the token isn't set. */
export function assertAuth(): void {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      "No auth found. Set CLAUDE_CODE_OAUTH_TOKEN (npx @anthropic-ai/claude-code setup-token) " +
        "or ANTHROPIC_API_KEY, then re-run."
    );
    process.exit(1);
  }
}
