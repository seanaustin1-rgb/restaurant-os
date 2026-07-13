import Anthropic from "@anthropic-ai/sdk";
import type { MessageChannel, MessageDirection } from "@prisma/client";

// AI draft-and-approve for agent messages. Mirrors src/lib/import/llm-extract.ts
// (the repo's canonical AI chokepoint): one place that calls Claude, a cached
// system prompt, structured output, and token usage returned for cost tracking.
// Drafting only — nothing sends here; the caller persists a MessageEvent in
// status DRAFT (aiDrafted, approvedAt null) and a separate approve→send step
// transmits.
//
// Current Sonnet tier — best nuance/compliance-tone per dollar for this
// production task (env-overridable, mirroring STATEMENT_EXTRACT_MODEL).
const MODEL = process.env.REALESTATE_DRAFT_MODEL || "claude-sonnet-5";

export type Tone = "professional" | "warm" | "casual";
export type Length = "short" | "standard" | "detailed";

export interface StyleProfile {
  agentName: string;
  brandTone?: string; // brokerage brand voice, freeform
  tone?: Tone; // slider
  length?: Length; // slider
  signature?: string; // optional sign-off
}

export interface LeadContext {
  fullName?: string | null;
  origin?: string | null; // marketing channel
  note?: string | null; // freeform context / thread so far
}

export interface DraftInput {
  channel: MessageChannel; // EMAIL or SMS
  style: StyleProfile;
  lead: LeadContext;
  intent: string; // e.g. "first outreach to a new referral"
}

export interface DraftResult {
  subject: string | null; // null for SMS
  body: string;
  usage: Anthropic.Messages.Usage;
  model: string;
}

// Base compliance + voice guardrails. The operator owns final Fair-Housing/TCPA
// sign-off, but these are the always-on floor. Cached (stable) prefix.
const SYSTEM = `You draft real-estate messages an agent sends to a client or lead, in the agent's own voice.
Rules:
- Write only what the agent could truthfully send. Never invent facts, prices, dates, availability, financing terms, or commitments that are not in the provided context.
- Fair Housing: never reference or imply race, color, religion, sex, familial status, national origin, or disability, and never steer toward or away from areas on those bases. Describe the property and the process, not protected characteristics of people or neighborhoods.
- TCPA / SMS: for text messages, keep it brief, identify the agent, and never imply consent the recipient has not given.
- No high-pressure or spammy language. Match the requested tone and length.
- Output ONLY the message. For email: a concise subject and a body. For SMS: a body only (leave subject empty).`;

// Structured output — subject is empty for SMS (normalized to null below).
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["subject", "body"],
} as const;

function toneHint(t: Tone = "professional"): string {
  if (t === "warm") return "Warm and relationship-first.";
  if (t === "casual") return "Friendly and casual.";
  return "Polished and professional.";
}

function lengthHint(l: Length = "standard"): string {
  if (l === "short") return "Keep it to 2-3 sentences.";
  if (l === "detailed") return "A thorough but focused message is fine.";
  return "Keep it concise.";
}

/** Build the per-request user prompt from the style profile + lead context. Pure. */
export function buildUserPrompt(input: DraftInput): string {
  const { channel, style, lead, intent } = input;
  return [
    `Channel: ${channel}${channel === "SMS" ? " (no subject; short)" : ""}`,
    `Agent: ${style.agentName}`,
    style.brandTone ? `Brokerage tone: ${style.brandTone}` : null,
    `Style: ${toneHint(style.tone)} ${lengthHint(style.length)}`,
    `Lead: ${lead.fullName ?? "the lead"}${lead.origin ? ` (from ${lead.origin})` : ""}`,
    lead.note ? `Context: ${lead.note}` : "First contact — no prior thread.",
    `Task: ${intent}`,
    style.signature ? `Sign off as: ${style.signature}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Normalize the model's raw JSON: trim, and drop the subject for SMS. Pure. */
export function normalizeDraft(
  raw: { subject?: string; body?: string },
  channel: MessageChannel,
): { subject: string | null; body: string } {
  const body = (raw.body ?? "").trim();
  const subject = channel === "EMAIL" ? (raw.subject ?? "").trim() || "(no subject)" : null;
  return { subject, body };
}

export function realestateDraftingAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Draft one message with Claude. Returns the subject/body plus token usage so the
 * caller can log per-draft cost. Not unit-tested (network); buildUserPrompt and
 * normalizeDraft carry the testable logic.
 */
export async function draftMessage(input: DraftInput): Promise<DraftResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    // SYSTEM is cached so every draft reuses the instruction prefix at ~10% input cost.
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserPrompt(input) }],
  });

  const text = message.content.find((b) => b.type === "text");
  const parsed = text && text.type === "text" ? JSON.parse(text.text) : {};
  const { subject, body } = normalizeDraft(parsed, input.channel);
  return { subject, body, usage: message.usage, model: MODEL };
}

// MessageEvent create data for a DRAFT — flat (unchecked) shape matching the
// Prisma model. status defaults to DRAFT, approvedAt/sentAt/providerId stay null
// until a human approves and the send step runs.
export interface MessageEventDraftData {
  restaurantId: string;
  leadId: string | null;
  agentId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  aiDrafted: boolean;
  aiModel: string;
  subject: string | null;
  body: string;
}

/** Map a DraftResult into MessageEvent create data (does not persist). Pure. */
export function toMessageEventDraft(params: {
  restaurantId: string;
  leadId?: string | null;
  agentId?: string | null;
  channel: MessageChannel;
  draft: DraftResult;
}): MessageEventDraftData {
  return {
    restaurantId: params.restaurantId,
    leadId: params.leadId ?? null,
    agentId: params.agentId ?? null,
    channel: params.channel,
    direction: "OUTBOUND",
    aiDrafted: true,
    aiModel: params.draft.model,
    subject: params.draft.subject,
    body: params.draft.body,
  };
}
