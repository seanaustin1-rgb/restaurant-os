import { describe, it, expect } from "vitest";
import { normalizeBoldTrailLead, mapLeadSource, normalizePhone } from "./lead-ingest";

describe("mapLeadSource", () => {
  it("maps known channels", () => {
    expect(mapLeadSource("Zillow Premier")).toBe("ZILLOW");
    expect(mapLeadSource("realtor.com")).toBe("REALTOR_COM");
    expect(mapLeadSource("Facebook Lead Ad")).toBe("FACEBOOK");
    expect(mapLeadSource("Client Referral")).toBe("REFERRAL");
    expect(mapLeadSource("Open House sign-in")).toBe("OPEN_HOUSE");
    expect(mapLeadSource("IDX Website")).toBe("IDX_WEBSITE");
    expect(mapLeadSource("kvCORE")).toBe("IDX_WEBSITE");
  });
  it("falls back to OTHER and null", () => {
    expect(mapLeadSource("carrier pigeon")).toBe("OTHER");
    expect(mapLeadSource(null)).toBeNull();
    expect(mapLeadSource("")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("formats 10-digit US numbers to E.164", () => {
    expect(normalizePhone("(208) 555-2004")).toBe("+12085552004");
  });
  it("handles a leading 1 and existing +", () => {
    expect(normalizePhone("1-208-555-2004")).toBe("+12085552004");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });
  it("returns null for junk", () => {
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("normalizeBoldTrailLead", () => {
  it("reads a flat payload", () => {
    const n = normalizeBoldTrailLead({
      id: "bt_123",
      first_name: "Sam",
      last_name: "Ortega",
      email: "sam@example.com",
      phone: "208-555-1234",
      source: "Zillow",
      created_at: "2026-07-06T12:00:00Z",
    });
    expect(n).toEqual({
      externalId: "bt_123",
      fullName: "Sam Ortega",
      email: "sam@example.com",
      phone: "+12085551234",
      origin: "ZILLOW",
      receivedAt: new Date("2026-07-06T12:00:00Z"),
    });
  });

  it("reads a contact nested under `lead` and a single name field", () => {
    const n = normalizeBoldTrailLead({
      lead: { lead_id: "bt_9", name: "The Whitfields", email: "w@example.com", lead_source: "Facebook" },
    });
    expect(n?.externalId).toBe("bt_9");
    expect(n?.fullName).toBe("The Whitfields");
    expect(n?.origin).toBe("FACEBOOK");
    expect(n?.receivedAt).toBeNull(); // absent → caller defaults to now
  });

  it("returns null when there is no usable identity", () => {
    expect(normalizeBoldTrailLead({ source: "Zillow" })).toBeNull();
    expect(normalizeBoldTrailLead(null)).toBeNull();
    expect(normalizeBoldTrailLead("nope")).toBeNull();
  });

  it("keeps an identity even if only a phone is present", () => {
    const n = normalizeBoldTrailLead({ phone: "2085550000" });
    expect(n?.phone).toBe("+12085550000");
    expect(n?.externalId).toBeNull();
  });
});
