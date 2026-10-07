import { NextResponse } from "next/server";
import { requireTeamAccess, TeamAccessDenied } from "@/lib/team/access";
import { teamDb } from "@/lib/team/db";
import { createStreamUpload, STREAM_PROVIDER } from "@/lib/team/media/stream";

export const runtime = "nodejs";

/** Provision a private TUS upload. The video bytes go from the phone to Stream. */
export async function POST(request: Request) {
  let input: { restaurantId?: unknown; byteLength?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (typeof input.restaurantId !== "string" || !input.restaurantId.trim() ||
      typeof input.byteLength !== "number" || !Number.isSafeInteger(input.byteLength) || input.byteLength <= 0) {
    return NextResponse.json({ error: "Invalid upload details" }, { status: 400 });
  }
  try {
    await requireTeamAccess(input.restaurantId, "MANAGER");
    const upload = await createStreamUpload(input.restaurantId, input.byteLength);
    const asset = await teamDb(input.restaurantId).teamMediaAsset.create({
      data: { restaurantId: input.restaurantId, provider: STREAM_PROVIDER, providerAssetId: upload.providerAssetId, status: "UPLOADING" },
      select: { id: true },
    });
    return NextResponse.json({ assetId: asset.id, uploadUrl: upload.uploadUrl, protocol: "tus" },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TeamAccessDenied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
