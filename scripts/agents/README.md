# Agents (Claude Agent SDK)

Small, runnable agents built on `@anthropic-ai/claude-agent-sdk`. Each file is one
agent; they share config + a runner via `_shared.ts`.

## Auth (one-time)

Agents authenticate with your Claude **subscription** (no API key) via an env var:

```powershell
npx @anthropic-ai/claude-code setup-token      # opens browser, prints sk-ant-oat...
setx CLAUDE_CODE_OAUTH_TOKEN "sk-ant-oat-..."  # persist for future shells
```

Open a new terminal after `setx` so the variable loads.

## Run

```powershell
npm run agent:cash -- "where is break-even calculated and what's the formula?"
npm run agent:menu -- "fixed costs 139000, margin 65%"
# or directly:
npx tsx scripts/agents/cash-analyst.ts "your question"
```

## Files

| File | What it shows |
|------|---------------|
| `_shared.ts`      | Shared `baseOptions` + `runAgent()` helper + auth guard |
| `cash-analyst.ts` | Read-only agent (Read/Grep/Glob) that analyzes the repo |
| `menu-pricer.ts`  | Custom in-process tool via `tool()` + `createSdkMcpServer()` |

## Add a new agent

1. Copy `cash-analyst.ts` to `scripts/agents/<name>.ts`.
2. Change the `SYSTEM_PROMPT` and `allowedTools`.
3. (Optional) add a `agent:<name>` script in `package.json`.

### Knobs worth knowing (set in each agent's `runAgent(..., options)`)

- `allowedTools` / `disallowedTools` — the safety dial. Read-only = `["Read","Grep","Glob"]`; add `"Edit","Write"` to let it change files.
- `permissionMode` — `"default"` (prompts), `"acceptEdits"` (auto-approve edits), `"bypassPermissions"` (fully autonomous).
- `model` — `claude-opus-4-8` (default) or `claude-sonnet-4-6` for cheaper/faster.
- `mcpServers` — hand the agent custom tools or external connectors.
- `agents` — declare named subagents the main agent can delegate to.
