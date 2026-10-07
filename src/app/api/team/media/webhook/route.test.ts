import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const h = vi.hoisted(() => ({ send: vi.fn(), teamDb: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: h.send } }));
vi.mock("@/lib/team/db", () => ({ teamDb: h.teamDb }));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET = "webhook_test";
  h.teamDb.mockReturnValue({ teamMediaAsset: { findFirst: h.findFirst } });
  h.findFirst.mockResolvedValue({ id: "asset_1" });
});

function notification(body: string, signed = true): Request {
  const time = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", "webhook_test").update(time).update(".").update(body).digest("hex");
  return new Request("https://app.test/api/team/media/webhook", {
    method: "POST", body, headers: { "Webhook-Signature": `time=${time},sig1=${signed ? sig : "0".repeat(64)}` },
  });
}

describe("Stream webhook", () => {
  it("rejects a forged callback before any database or event access", async () => {
    expect((await POST(notification("{}", false))).status).toBe(401);
    expect(h.teamDb).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("dispatches a signed, tenant-scoped ready event without exposing playback URLs", async () => {
    const body = JSON.stringify({ uid: "video_1", meta: { teamrestaurantid: "tenant_a" },
      status: { state: "ready" }, readyToStream: true, duration: 45.8,
      playback: { hls: "https://public.example/video.m3u8" } });
    const response = await POST(notification(body));
    expect(response.status).toBe(200);
    expect(h.teamDb).toHaveBeenCalledWith("tenant_a");
    expect(h.findFirst).toHaveBeenCalledWith({
      where: { provider: "CLOUDFLARE_STREAM", providerAssetId: "video_1" }, select: { id: true },
    });
    expect(h.send).toHaveBeenCalledWith({ name: "team/media.ready", data: {
      restaurantId: "tenant_a", assetId: "asset_1", providerAssetId: "video_1", ready: true, durationSec: 46,
    } });
    expect(JSON.stringify(await response.json())).not.toContain("public.example");
  });

  it("does not accept an asset from another restaurant", async () => {
    h.findFirst.mockResolvedValue(null);
    const body = JSON.stringify({ uid: "video_1", meta: { teamrestaurantid: "tenant_b" }, status: { state: "ready" }, readyToStream: true });
    expect((await POST(notification(body))).status).toBe(404);
    expect(h.send).not.toHaveBeenCalled();
  });
});
