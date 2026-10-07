import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ access: vi.fn(), teamDb: vi.fn(), create: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/team/access", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/team/access")>(), requireTeamAccess: h.access,
}));
vi.mock("@/lib/team/db", () => ({ teamDb: h.teamDb }));
vi.mock("@/lib/team/media/stream", () => ({ STREAM_PROVIDER: "CLOUDFLARE_STREAM", createStreamUpload: h.upload }));

import { TeamAccessDenied } from "@/lib/team/access";
import { POST } from "./route";

const request = (restaurantId = "tenant_a") => new Request("https://app.test/api/team/media/upload", {
  method: "POST", body: JSON.stringify({ restaurantId, byteLength: 5000 }),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.access.mockResolvedValue({ role: "MANAGER" });
  h.upload.mockResolvedValue({ uploadUrl: "https://upload.videodelivery.net/private", providerAssetId: "video_1" });
  h.create.mockResolvedValue({ id: "asset_1" });
  h.teamDb.mockReturnValue({ teamMediaAsset: { create: h.create } });
});

describe("Team direct upload route", () => {
  it("requires manager access to the explicit tenant before provisioning Stream", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(h.access).toHaveBeenCalledWith("tenant_a", "MANAGER");
    expect(h.upload).toHaveBeenCalledWith("tenant_a", 5000);
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
    expect(h.create).toHaveBeenCalledWith({
      data: { restaurantId: "tenant_a", provider: "CLOUDFLARE_STREAM", providerAssetId: "video_1", status: "UPLOADING" },
      select: { id: true },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("denies a manager from a different tenant without a Stream call", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    expect((await POST(request("tenant_b"))).status).toBe(403);
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.teamDb).not.toHaveBeenCalled();
  });
});
