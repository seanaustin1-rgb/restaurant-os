import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ access: vi.fn(), teamDb: vi.fn(), findFirst: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/team/access", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/team/access")>(), requireTeamAccess: h.access,
}));
vi.mock("@/lib/team/db", () => ({ teamDb: h.teamDb }));
vi.mock("@/lib/team/media/stream", () => ({ STREAM_PROVIDER: "CLOUDFLARE_STREAM", signStreamPlayback: h.sign }));

import { TeamAccessDenied } from "@/lib/team/access";
import { GET } from "./route";

const member = { restaurantId: "tenant_a", clerkUserId: "user_1", membershipId: "member_a", role: "MEMBER", departments: ["MGMT"] };
const readyLesson = { mediaAsset: { provider: "CLOUDFLARE_STREAM", providerAssetId: "video_1", status: "READY" } };
const request = (tenant = "tenant_a") => new Request(`https://app.test/api/team/media/lesson_1/token?restaurantId=${tenant}`);

beforeEach(() => {
  vi.clearAllMocks();
  h.access.mockResolvedValue(member);
  h.findFirst.mockResolvedValue(readyLesson);
  h.teamDb.mockReturnValue({ teamLesson: { findFirst: h.findFirst } });
  h.sign.mockReturnValue({ token: "signed", expiresAt: "2026-10-07T01:00:00.000Z" });
});

describe("Team media token", () => {
  it("uses the shared visibility predicate so even a MGMT member gets 404 for managers-only", async () => {
    h.findFirst.mockResolvedValue(null);
    const response = await GET(request(), { params: { lessonId: "lesson_1" } });
    expect(response.status).toBe(404);
    expect(h.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "lesson_1", status: "PUBLISHED", managersOnly: false }),
    }));
    expect(h.sign).not.toHaveBeenCalled();
  });

  it("allows a manager or owner and returns only a signed token", async () => {
    h.access.mockResolvedValue({ ...member, role: "MANAGER", membershipId: null });
    const response = await GET(request(), { params: { lessonId: "lesson_1" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "signed", expiresAt: "2026-10-07T01:00:00.000Z" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(h.findFirst.mock.calls[0][0].where).not.toHaveProperty("managersOnly");
  });

  it("does not mint a token for a different tenant or a removed member", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    expect((await GET(request("tenant_b"), { params: { lessonId: "lesson_1" } })).status).toBe(403);
    expect(h.access).toHaveBeenCalledWith("tenant_b");
    expect(h.teamDb).not.toHaveBeenCalled();
    expect(h.sign).not.toHaveBeenCalled();
  });

  it("uses the requested tenant for the lesson and denies missing or unready media", async () => {
    h.findFirst.mockResolvedValue({ mediaAsset: { ...readyLesson.mediaAsset, status: "PROCESSING" } });
    expect((await GET(request(), { params: { lessonId: "lesson_1" } })).status).toBe(404);
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
  });
});
