import { describe, expect, it } from "vitest";
import { playbackRefreshDelay } from "./playback-client";
describe("Private playback renewal after phone backgrounding", () => {
  const issued = Date.parse("2026-10-07T12:00:00Z");
  const expiry = "2026-10-07T13:00:00Z";
  it("renews a fresh one-hour token after 55 minutes", () => {
    expect(playbackRefreshDelay(expiry, issued)).toBe(55 * 60000);
  });
  it("resuming after 50 minutes renews in nine minutes instead of starting a fresh 55-minute timer", () => {
    expect(playbackRefreshDelay(expiry, issued + 50 * 60000)).toBe(9 * 60000);
  });
  it("requires an immediate fresh token when expired, nearly expired, or invalid", () => {
    expect(playbackRefreshDelay(expiry, issued + 59 * 60000)).toBe(0);
    expect(playbackRefreshDelay(expiry, issued + 61 * 60000)).toBe(0);
    expect(playbackRefreshDelay("invalid", issued)).toBe(0);
  });
});
