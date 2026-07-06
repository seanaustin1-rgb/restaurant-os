import { describe, it, expect } from "vitest";
import {
  buildUserPrompt,
  normalizeDraft,
  toMessageEventDraft,
  type DraftInput,
  type DraftResult,
} from "./draft-message";

const baseInput: DraftInput = {
  channel: "EMAIL",
  style: { agentName: "Maya Chen", tone: "warm", length: "short", brandTone: "Ridgeline Realty" },
  lead: { fullName: "Sam Ortega", origin: "REFERRAL", note: "Referred by Priya; starting to look." },
  intent: "first outreach to a new referral",
};

describe("buildUserPrompt", () => {
  it("includes agent, lead, intent, brand tone, and style", () => {
    const p = buildUserPrompt(baseInput);
    expect(p).toContain("Agent: Maya Chen");
    expect(p).toContain("Lead: Sam Ortega (from REFERRAL)");
    expect(p).toContain("Task: first outreach to a new referral");
    expect(p).toContain("Brokerage tone: Ridgeline Realty");
    expect(p).toContain("Warm and relationship-first.");
    expect(p).toContain("Keep it to 2-3 sentences.");
  });

  it("flags SMS as no-subject and short", () => {
    const p = buildUserPrompt({ ...baseInput, channel: "SMS" });
    expect(p).toContain("Channel: SMS (no subject; short)");
  });

  it("says first contact when there is no note", () => {
    const p = buildUserPrompt({ ...baseInput, lead: { fullName: "Sam" } });
    expect(p).toContain("First contact — no prior thread.");
  });
});

describe("normalizeDraft", () => {
  it("trims and keeps a subject for email", () => {
    expect(normalizeDraft({ subject: "  Hello  ", body: "  Hi Sam  " }, "EMAIL")).toEqual({
      subject: "Hello",
      body: "Hi Sam",
    });
  });

  it("falls back to a placeholder subject for an empty email subject", () => {
    expect(normalizeDraft({ subject: "", body: "Hi" }, "EMAIL").subject).toBe("(no subject)");
  });

  it("drops the subject entirely for SMS", () => {
    expect(normalizeDraft({ subject: "ignored", body: "Hey Sam" }, "SMS")).toEqual({
      subject: null,
      body: "Hey Sam",
    });
  });
});

describe("toMessageEventDraft", () => {
  const draft: DraftResult = {
    subject: "Great to connect",
    body: "Hi Sam — Priya passed along that you're looking...",
    usage: {} as DraftResult["usage"],
    model: "claude-sonnet-5",
  };

  it("maps into an OUTBOUND, AI-drafted MessageEvent create shape", () => {
    const data = toMessageEventDraft({
      restaurantId: "rest_1",
      leadId: "lead_1",
      agentId: "agent_1",
      channel: "EMAIL",
      draft,
    });
    expect(data).toEqual({
      restaurantId: "rest_1",
      leadId: "lead_1",
      agentId: "agent_1",
      channel: "EMAIL",
      direction: "OUTBOUND",
      aiDrafted: true,
      aiModel: "claude-sonnet-5",
      subject: "Great to connect",
      body: draft.body,
    });
  });

  it("defaults missing lead/agent to null (unassigned draft)", () => {
    const data = toMessageEventDraft({ restaurantId: "rest_1", channel: "SMS", draft });
    expect(data.leadId).toBeNull();
    expect(data.agentId).toBeNull();
  });
});
