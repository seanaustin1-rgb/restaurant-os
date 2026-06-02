import Anthropic from "@anthropic-ai/sdk";

// Default to the most capable model. For a high-volume statement extractor you
// may prefer claude-sonnet-4-6 (≈40% the cost) or claude-haiku-4-5 (cheapest) —
// change MODEL below. Set via env to make it configurable without a code change.
const MODEL = process.env.STATEMENT_EXTRACT_MODEL || "claude-opus-4-8";

export interface LlmTxn {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // positive
  direction: "debit" | "credit";
}

const SYSTEM = `You extract posted transactions from bank statements (often scanned images).
Return ONLY data matching the schema. Rules:
- date: ISO yyyy-mm-dd. Infer the year from the statement period shown on the page.
- description: the merchant/payee/memo text, trimmed of extra whitespace.
- amount: the transaction amount as a POSITIVE number — no sign, no currency symbol, no thousands separators.
- direction: "debit" for money leaving the account (withdrawals, payments, purchases, fees, checks),
  "credit" for money entering (deposits, refunds, interest paid to the account).
- A row with separate debit/credit columns: use whichever column is populated.
- EXCLUDE running balances, daily/period summary totals, beginning/ending balance lines,
  and any interest-rate/APR percentages. Only individual posted transactions.`;

// JSON Schema for structured outputs. Keep it within supported features
// (no min/max, additionalProperties:false on every object).
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string", description: "ISO yyyy-mm-dd" },
          description: { type: "string" },
          amount: { type: "number", description: "positive amount" },
          direction: { type: "string", enum: ["debit", "credit"] },
        },
        required: ["date", "description", "amount", "direction"],
      },
    },
  },
  required: ["transactions"],
} as const;

export function llmExtractionAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ExtractionResult {
  transactions: LlmTxn[];
  usage: Anthropic.Messages.Usage;
  model: string;
}

function normalizeTxns(raw: { transactions?: LlmTxn[] }): LlmTxn[] {
  return (raw.transactions ?? [])
    .map((t) => ({
      date: String(t.date),
      description: String(t.description ?? "").trim() || "Statement transaction",
      amount: Math.abs(Number(t.amount)) || 0,
      direction: (t.direction === "credit" ? "credit" : "debit") as "debit" | "credit",
    }))
    .filter((t) => t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
}

/**
 * Extract transactions from an image-based / scanned PDF by sending it to Claude
 * as a document block and constraining the response to a JSON schema. Streams the
 * response so large statements don't hit an HTTP timeout. Returns the parsed
 * transactions plus token usage so callers can track per-statement cost.
 */
export async function extractTransactionsWithLLMDetailed(pdf: Uint8Array): Promise<ExtractionResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const data = Buffer.from(pdf).toString("base64");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    output_config: {
      // Constrain output to the schema. SYSTEM is cached so repeated extractions
      // reuse the instruction prefix.
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data },
          },
          { type: "text", text: "Extract every posted transaction from this statement." },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find((b) => b.type === "text");

  let transactions: LlmTxn[] = [];
  if (textBlock && textBlock.type === "text") {
    try {
      transactions = normalizeTxns(JSON.parse(textBlock.text));
    } catch {
      transactions = [];
    }
  }

  return { transactions, usage: message.usage, model: MODEL };
}

/** Convenience wrapper returning just the transactions (used by the import route). */
export async function extractTransactionsWithLLM(pdf: Uint8Array): Promise<LlmTxn[]> {
  return (await extractTransactionsWithLLMDetailed(pdf)).transactions;
}
