import { publishQueuedLessons } from "@/lib/team/lessons";
import { teamDb } from "@/lib/team/db";
import { streamHasReadyCaptions, STREAM_PROVIDER } from "./stream";

/** Idempotent across duplicate webhooks and Inngest retries; no lesson is created here. */
export async function settleTeamMedia(input: {
  restaurantId: string; assetId: string; providerAssetId: string; ready: boolean; durationSec: number | null;
}) {
  const db = teamDb(input.restaurantId);
  const asset = await db.teamMediaAsset.findFirst({
    where: { id: input.assetId, provider: STREAM_PROVIDER, providerAssetId: input.providerAssetId },
    select: { id: true, status: true },
  });
  if (!asset) return { updated: false, reason: "unknown-asset" };
  if (asset.status === "READY") { await publishQueuedLessons(input.restaurantId, asset.id); return { updated: false, reason: "already-ready" }; }
  const hasCaptions = input.ready ? await streamHasReadyCaptions(input.providerAssetId) : false;
  const result = await db.teamMediaAsset.updateMany({
    where: { id: asset.id, status: { not: "READY" } },
    data: {
      status: input.ready ? "READY" : "FAILED",
      durationSec: input.ready ? input.durationSec : null,
      hasCaptions,
    },
  });
  if (input.ready) await publishQueuedLessons(input.restaurantId, asset.id);
  return { updated: result.count === 1 };
}
