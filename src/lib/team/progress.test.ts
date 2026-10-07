import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ access: vi.fn(), db: vi.fn(), lesson: vi.fn(), upsert: vi.fn(), update: vi.fn(), logRead: vi.fn(), logWrite: vi.fn() }));
vi.mock("./access", async original => ({ ...await original<typeof import("./access")>(), requireTeamAccess: h.access }));
vi.mock("./db", () => ({ teamDb: h.db }));
import { TeamAccessDenied } from "./access";
import { playedSeconds, recordTeamProgress } from "./progress";
const input = { restaurantId: "a", lessonId: "lesson", version: 1, ranges: [[0, 90]] as [number, number][] };
let saved: unknown;
beforeEach(() => {
  vi.clearAllMocks(); saved = null;
  h.access.mockResolvedValue({ restaurantId: "a", clerkUserId: "user", role: "MEMBER", departments: ["FOH"], membershipId: "member" });
  h.lesson.mockResolvedValue({ version: 1, mediaAsset: { status: "READY", durationSec: 100 } });
  h.logRead.mockImplementation(async () => saved ? { detail: saved } : null);
  h.logWrite.mockImplementation(async ({ data }) => { saved = data.detail; });
  const db = { teamLesson: { findFirst: h.lesson }, teamMembership: { findFirst: vi.fn().mockResolvedValue({ id: "member" }) },
    teamLessonProgress: { upsert: h.upsert, updateMany: h.update }, teamActionLog: { findFirst: h.logRead, create: h.logWrite }, $transaction: vi.fn() };
  db.$transaction.mockImplementation(async work => work(db)); h.db.mockReturnValue(db);
});
describe("Phase 4 progress beacon", () => {
  it("unions overlapping/replayed ranges and does not count skipped time", () => {
    expect(playedSeconds([[0, 30], [20, 40], [90, 100]], 100)).toBe(50);
    expect(playedSeconds([[99, 100]], 100)).toBe(1);
  });
  it("marks watched at exactly 90% of stored duration, but not 89.9% or scroll-past", async () => {
    await recordTeamProgress({ ...input, ranges: [[0, 89.9]] });
    expect(h.upsert.mock.calls[0][0].create).not.toHaveProperty("watchedAt"); expect(h.update).not.toHaveBeenCalled();
    await recordTeamProgress(input);
    expect(h.update.mock.calls[0][0].data.watchedAt).toBeInstanceOf(Date);
    h.upsert.mockClear();
    await recordTeamProgress({ ...input, ranges: [] });
    expect(h.upsert).not.toHaveBeenCalled();
  });
  it("accumulates coverage across two visits without counting repeated playback twice", async () => {
    await recordTeamProgress({ ...input, ranges: [[0, 50]] });
    expect(h.update).not.toHaveBeenCalled();
    await recordTeamProgress({ ...input, ranges: [[0, 50]] });
    expect(h.update).not.toHaveBeenCalled();
    await recordTeamProgress({ ...input, ranges: [[50, 90]] });
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(saved).toEqual({ version: 1, ranges: [[0, 90]] });
  });
  it("preserves watched timestamp on duplicate or later partial beacons", async () => {
    await recordTeamProgress(input); await recordTeamProgress({ ...input, ranges: [[0, 10]] });
    expect(h.upsert.mock.calls[1][0].update).toEqual({});
    expect(h.update.mock.calls[1][0].where).toMatchObject({ watchedAt: null, lessonVersion: 1 });
  });
  it.each([
    { ranges: [[0, 101.1]] }, { ranges: [[-1, 10]] }, { ranges: [[10, 1]] }, { ranges: [[0, Infinity]] }, { ranges: [[0, "90"]] },
  ])("rejects malformed ranges $ranges", ({ ranges }) => {
    expect(() => playedSeconds(ranges as unknown as [number, number][], 100)).toThrow();
  });
  it("rejects another tenant or removed member before data access", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    await expect(recordTeamProgress({ ...input, restaurantId: "b" })).rejects.toBeInstanceOf(TeamAccessDenied);
    expect(h.db).not.toHaveBeenCalled();
  });
  it("hides manager-only and mismatched departments, and rejects stale versions", async () => {
    h.lesson.mockResolvedValueOnce(null);
    expect(await recordTeamProgress(input)).toBe("not-found");
    expect(h.lesson.mock.calls[0][0].where).toMatchObject({ id: "lesson", status: "PUBLISHED", managersOnly: false });
    expect(await recordTeamProgress({ ...input, version: 2 })).toBe("stale");
    expect(h.upsert).not.toHaveBeenCalled();
  });
});
