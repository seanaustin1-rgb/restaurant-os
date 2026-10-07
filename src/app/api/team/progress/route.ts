import { NextResponse } from "next/server";
import { TeamAccessDenied } from "@/lib/team/access";
import { recordTeamProgress } from "@/lib/team/progress";
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!input || typeof input.restaurantId !== "string" || typeof input.lessonId !== "string" ||
      !Number.isSafeInteger(input.version) || input.version < 1 || !Array.isArray(input.ranges)) return NextResponse.json({ error: "Invalid playback" }, { status: 400 });
  try {
    const result = await recordTeamProgress(input);
    if (result === "not-found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result === "stale") return NextResponse.json({ error: "Reload this lesson" }, { status: 409 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof TeamAccessDenied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message.startsWith("Invalid play")) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
