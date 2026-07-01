import { describe, expect, it } from "vitest";
import { canReadAudience, canWriteMetricNotes, normalizeAudience, readableAudiencesFor } from "./metric-notes";

describe("canWriteMetricNotes", () => {
  it("lets operators, managers, and consultants author notes", () => {
    expect(canWriteMetricNotes("OPERATOR")).toBe(true);
    expect(canWriteMetricNotes("MANAGER")).toBe(true);
    expect(canWriteMetricNotes("CONSULTANT")).toBe(true);
  });

  it("never lets an investor write a note", () => {
    expect(canWriteMetricNotes("INVESTOR")).toBe(false);
  });

  it("treats no-role-on-tenant as read-only", () => {
    expect(canWriteMetricNotes(null)).toBe(false);
    expect(canWriteMetricNotes(undefined)).toBe(false);
  });
});

describe("readableAudiencesFor", () => {
  it("limits an investor to INVESTOR notes only", () => {
    expect(readableAudiencesFor("INVESTOR")).toEqual(["INVESTOR"]);
  });

  it("gives writers both audiences", () => {
    expect(readableAudiencesFor("OPERATOR")).toEqual(["INTERNAL", "INVESTOR"]);
    expect(readableAudiencesFor("MANAGER")).toEqual(["INTERNAL", "INVESTOR"]);
    expect(readableAudiencesFor("CONSULTANT")).toEqual(["INTERNAL", "INVESTOR"]);
  });

  it("gives a user with no role on the tenant nothing", () => {
    expect(readableAudiencesFor(null)).toEqual([]);
    expect(readableAudiencesFor(undefined)).toEqual([]);
  });
});

describe("canReadAudience — the leak guard", () => {
  it("an INTERNAL note never reaches an investor", () => {
    expect(canReadAudience("INVESTOR", "INTERNAL")).toBe(false);
  });

  it("an INVESTOR-shared note does reach an investor", () => {
    expect(canReadAudience("INVESTOR", "INVESTOR")).toBe(true);
  });

  it("an operator sees both internal and shared notes", () => {
    expect(canReadAudience("OPERATOR", "INTERNAL")).toBe(true);
    expect(canReadAudience("OPERATOR", "INVESTOR")).toBe(true);
  });
});

describe("normalizeAudience — never trust the raw write", () => {
  it("passes INVESTOR through", () => {
    expect(normalizeAudience("INVESTOR")).toBe("INVESTOR");
  });

  it("defaults everything else to the safe INTERNAL side", () => {
    expect(normalizeAudience("INTERNAL")).toBe("INTERNAL");
    expect(normalizeAudience("investor")).toBe("INTERNAL"); // wrong case is not a match
    expect(normalizeAudience("PUBLIC")).toBe("INTERNAL");
    expect(normalizeAudience(undefined)).toBe("INTERNAL");
    expect(normalizeAudience(null)).toBe("INTERNAL");
  });
});
