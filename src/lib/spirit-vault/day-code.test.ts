import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appBaseUrl,
  dayCodeFor,
  dayGateEnabled,
  isValidDayCode,
  normalizeCode,
  qrTargetUrl,
  secondsUntilVenueMidnight,
  todayCode,
  venueDateKey,
} from "./day-code";

const ORIG = { ...process.env };

beforeEach(() => {
  process.env.SPIRIT_VAULT_DAY_SECRET = "test-secret-abc";
  process.env.SPIRIT_VAULT_RESTAURANT_ID = "rest-1";
  process.env.SPIRIT_VAULT_TZ = "America/New_York";
  delete process.env.NEXT_PUBLIC_APP_URL;
});
afterEach(() => {
  process.env = { ...ORIG };
});

describe("dayCodeFor", () => {
  it("is deterministic for the same date + secret + tenant", () => {
    expect(dayCodeFor("2026-08-18")).toBe(dayCodeFor("2026-08-18"));
  });

  it("changes from one day to the next", () => {
    expect(dayCodeFor("2026-08-18")).not.toBe(dayCodeFor("2026-08-19"));
  });

  it("differs by tenant", () => {
    expect(dayCodeFor("2026-08-18", { tenant: "a" })).not.toBe(dayCodeFor("2026-08-18", { tenant: "b" }));
  });

  it("differs by secret (can't be computed without it)", () => {
    expect(dayCodeFor("2026-08-18", { secret: "s1" })).not.toBe(dayCodeFor("2026-08-18", { secret: "s2" }));
  });

  it("uses only unambiguous alphabet glyphs and is 6 chars", () => {
    const code = dayCodeFor("2026-08-18");
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  it("throws when no secret is configured", () => {
    delete process.env.SPIRIT_VAULT_DAY_SECRET;
    expect(() => dayCodeFor("2026-08-18")).toThrow(/SECRET/i);
  });
});

describe("gate enablement", () => {
  it("is enabled only when a secret is set", () => {
    expect(dayGateEnabled()).toBe(true);
    delete process.env.SPIRIT_VAULT_DAY_SECRET;
    expect(dayGateEnabled()).toBe(false);
  });
});

describe("normalizeCode", () => {
  it("uppercases and strips spaces/hyphens/ambiguous glyphs", () => {
    expect(normalizeCode(" k7q2-m9 ")).toBe("K7Q2M9");
  });
});

describe("isValidDayCode", () => {
  it("accepts today's code, case-insensitively", () => {
    const now = new Date("2026-08-18T15:00:00Z");
    const code = todayCode(now);
    expect(isValidDayCode(code.toLowerCase(), now)).toBe(true);
  });

  it("rejects an empty/garbage code", () => {
    const now = new Date("2026-08-18T15:00:00Z");
    expect(isValidDayCode("", now)).toBe(false);
    expect(isValidDayCode("ZZZZZZ", now)).toBe(false);
  });

  it("rejects yesterday's code (forces on-site today)", () => {
    const today = new Date("2026-08-18T15:00:00Z");
    const yesterday = new Date("2026-08-17T15:00:00Z");
    const stale = todayCode(yesterday);
    // Extremely unlikely collision; guard the assertion's premise.
    if (stale !== todayCode(today)) {
      expect(isValidDayCode(stale, today)).toBe(false);
    }
  });

  it("is false when the gate is disabled (no secret)", () => {
    const now = new Date("2026-08-18T15:00:00Z");
    const code = todayCode(now);
    delete process.env.SPIRIT_VAULT_DAY_SECRET;
    expect(isValidDayCode(code, now)).toBe(false);
  });
});

describe("venueDateKey", () => {
  it("rolls the date in the venue timezone, not UTC", () => {
    // 02:30 UTC on the 18th is still 22:30 on the 17th in New York.
    const instant = new Date("2026-08-18T02:30:00Z");
    expect(venueDateKey(instant, "America/New_York")).toBe("2026-08-17");
    expect(venueDateKey(instant, "UTC")).toBe("2026-08-18");
  });
});

describe("secondsUntilVenueMidnight", () => {
  it("is within (0, 86400] and shrinks as the day advances", () => {
    const morning = new Date("2026-08-18T12:00:00Z"); // 08:00 ET
    const evening = new Date("2026-08-18T23:00:00Z"); // 19:00 ET
    const m = secondsUntilVenueMidnight(morning);
    const e = secondsUntilVenueMidnight(evening);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThanOrEqual(86400);
    expect(e).toBeLessThan(m);
  });
});

describe("qrTargetUrl", () => {
  it("routes through the day-code entry when the gate is enabled", () => {
    const now = new Date("2026-08-18T15:00:00Z");
    const url = qrTargetUrl("/vault/flights/abc", now);
    expect(url).toBe(`https://www.outfrontdata.com/v/${todayCode(now)}?to=${encodeURIComponent("/vault/flights/abc")}`);
  });

  it("links straight to the destination when the gate is disabled", () => {
    delete process.env.SPIRIT_VAULT_DAY_SECRET;
    expect(qrTargetUrl("/vault/flights/abc")).toBe("https://www.outfrontdata.com/vault/flights/abc");
  });

  it("honors NEXT_PUBLIC_APP_URL and trims a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com/";
    expect(appBaseUrl()).toBe("https://staging.example.com");
    delete process.env.SPIRIT_VAULT_DAY_SECRET;
    expect(qrTargetUrl("/vault")).toBe("https://staging.example.com/vault");
  });
});
