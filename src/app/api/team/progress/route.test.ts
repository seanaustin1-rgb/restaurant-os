import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@/lib/team/progress", () => ({ recordTeamProgress: h.record }));
import { TeamAccessDenied } from "@/lib/team/access";
import { POST } from "./route";
const request = (input: unknown = { restaurantId: "a", lessonId: "lesson", version: 1, ranges: [[0, 90]] }) =>
  new Request("https://app.test/api/team/progress", { method: "POST", body: JSON.stringify(input) });
beforeEach(() => { vi.clearAllMocks(); h.record.mockResolvedValue("ok"); });
describe("Phase 4 progress route", () => {
  it("accepts played ranges, not a client duration/completion flag", async () => {
    expect((await POST(request())).status).toBe(204);
    expect(h.record).toHaveBeenCalledWith({ restaurantId: "a", lessonId: "lesson", version: 1, ranges: [[0, 90]] });
    expect((await POST(request({ restaurantId: "a", lessonId: "lesson", completed: true }))).status).toBe(400);
  });
  it("returns indistinguishable 404 for hidden/missing lessons and denies revoked/cross-tenant access", async () => {
    h.record.mockResolvedValue("not-found"); expect((await POST(request())).status).toBe(404);
    h.record.mockRejectedValue(new TeamAccessDenied()); expect((await POST(request())).status).toBe(403);
  });
  it("rejects stale version, malformed played ranges and cross-origin beacons", async () => {
    h.record.mockResolvedValue("stale"); expect((await POST(request())).status).toBe(409);
    h.record.mockRejectedValue(new Error("Invalid played range")); expect((await POST(request())).status).toBe(400);
    h.record.mockClear();
    expect((await POST(new Request("https://app.test/api/team/progress", { method: "POST", headers: { origin: "https://other.test" }, body: "{}" }))).status).toBe(403);
    expect(h.record).not.toHaveBeenCalled();
  });
});
