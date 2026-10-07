import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ teamDb: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), captions: vi.fn() }));
vi.mock("@/lib/team/db", () => ({ teamDb: h.teamDb }));
vi.mock("./stream", () => ({ STREAM_PROVIDER: "CLOUDFLARE_STREAM", streamHasReadyCaptions: h.captions }));

import { settleTeamMedia } from "./ready";

const input = { restaurantId: "tenant_a", assetId: "asset_1", providerAssetId: "video_1", ready: true, durationSec: 46 };

beforeEach(() => {
  vi.clearAllMocks();
  h.teamDb.mockReturnValue({ teamMediaAsset: { findFirst: h.findFirst, updateMany: h.updateMany } });
  h.findFirst.mockResolvedValue({ id: "asset_1", status: "UPLOADING" });
  h.updateMany.mockResolvedValue({ count: 1 });
  h.captions.mockResolvedValue(true);
});

describe("team/media.ready", () => {
  it("updates only its tenant-scoped asset with duration and ready captions", async () => {
    expect(await settleTeamMedia(input)).toEqual({ updated: true });
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
    expect(h.findFirst).toHaveBeenCalledWith({
      where: { id: "asset_1", provider: "CLOUDFLARE_STREAM", providerAssetId: "video_1" },
      select: { id: true, status: true },
    });
    expect(h.updateMany).toHaveBeenCalledWith({
      where: { id: "asset_1", status: { not: "READY" } },
      data: { status: "READY", durationSec: 46, hasCaptions: true },
    });
  });

  it("can retry after a simulated Stream timeout and remains idempotent", async () => {
    h.captions.mockRejectedValueOnce(new Error("Stream timeout")).mockResolvedValueOnce(false);
    await expect(settleTeamMedia(input)).rejects.toThrow("Stream timeout");
    expect(h.updateMany).not.toHaveBeenCalled();
    await expect(settleTeamMedia(input)).resolves.toEqual({ updated: true });
    h.findFirst.mockResolvedValue({ id: "asset_1", status: "READY" });
    await expect(settleTeamMedia(input)).resolves.toEqual({ updated: false, reason: "already-ready" });
    expect(h.updateMany).toHaveBeenCalledTimes(1);
  });
});
