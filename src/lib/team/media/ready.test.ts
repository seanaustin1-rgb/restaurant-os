import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ teamDb: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), captions: vi.fn(), publish: vi.fn() }));
vi.mock("@/lib/team/db", () => ({ teamDb: h.teamDb }));
vi.mock("./stream", () => ({ STREAM_PROVIDER: "CLOUDFLARE_STREAM", streamHasReadyCaptions: h.captions }));

vi.mock("@/lib/team/lessons", () => ({ publishQueuedLessons: h.publish }));
import { settleTeamMedia } from "./ready";

const input = { restaurantId: "tenant_a", assetId: "asset_1", providerAssetId: "video_1", ready: true, durationSec: 46 };

beforeEach(() => {
  vi.clearAllMocks(); h.publish.mockReset();
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
    expect(h.publish).toHaveBeenCalledWith("tenant_a", "asset_1");
  });
});

describe("Phase 4 ready-job publication retry", () => {
  it("retries the manager-approved intent even after the asset already became READY", async () => {
    h.publish.mockRejectedValueOnce(new Error("publish timeout"));
    await expect(settleTeamMedia(input)).rejects.toThrow("publish timeout");
    h.findFirst.mockResolvedValue({ id: "asset_1", status: "READY" });
    await expect(settleTeamMedia(input)).resolves.toEqual({ updated: false, reason: "already-ready" });
    expect(h.publish).toHaveBeenCalledTimes(2);
    expect(h.updateMany).toHaveBeenCalledTimes(1);
  });
});