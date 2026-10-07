import { NextResponse } from "next/server";
import { requireTeamAccess, TeamAccessDenied, visibleLessonFilter } from "@/lib/team/access";
import { teamDb } from "@/lib/team/db";
import { signStreamPlayback, STREAM_PROVIDER } from "@/lib/team/media/stream";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: { lessonId: string } }) {
  const restaurantId = new URL(request.url).searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });
  try {
    const viewer = await requireTeamAccess(restaurantId);
    const lesson = await teamDb(restaurantId).teamLesson.findFirst({
      where: { id: params.lessonId, ...visibleLessonFilter(viewer) },
      select: { mediaAsset: { select: { provider: true, providerAssetId: true, status: true } } },
    });
    if (!lesson?.mediaAsset || lesson.mediaAsset.status !== "READY" || lesson.mediaAsset.provider !== STREAM_PROVIDER) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(signStreamPlayback(lesson.mediaAsset.providerAssetId), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof TeamAccessDenied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw error;
  }
}
