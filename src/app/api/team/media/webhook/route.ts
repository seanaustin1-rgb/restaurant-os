import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { teamDb } from "@/lib/team/db";
import { STREAM_PROVIDER, verifyStreamWebhook } from "@/lib/team/media/stream";

export const runtime = "nodejs";

interface StreamNotification {
  uid?: unknown;
  meta?: { teamrestaurantid?: unknown };
  status?: { state?: unknown };
  readyToStream?: unknown;
  duration?: unknown;
}

/** Machine callback: Cloudflare's signature is its authentication, not Clerk. */
export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (!verifyStreamWebhook(raw, request.headers.get("webhook-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: StreamNotification;
  try { payload = JSON.parse(raw.toString("utf8")) as StreamNotification; }
  catch { return NextResponse.json({ error: "Invalid notification" }, { status: 400 }); }
  const restaurantId = payload.meta?.teamrestaurantid;
  const providerAssetId = payload.uid;
  if (typeof restaurantId !== "string" || !restaurantId || typeof providerAssetId !== "string" || !providerAssetId ||
      !["ready", "error"].includes(String(payload.status?.state))) {
    return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
  }
  const asset = await teamDb(restaurantId).teamMediaAsset.findFirst({
    where: { provider: STREAM_PROVIDER, providerAssetId }, select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  await inngest.send({
    name: "team/media.ready",
    data: {
      restaurantId, assetId: asset.id, providerAssetId,
      ready: payload.status?.state === "ready" && payload.readyToStream === true,
      durationSec: typeof payload.duration === "number" && Number.isFinite(payload.duration)
        ? Math.max(0, Math.round(payload.duration)) : null,
    },
  });
  return NextResponse.json({ queued: true });
}
