import { NextResponse } from "next/server";
import { TeamAccessDenied } from "@/lib/team/access";
import { markTeamFeedSeen } from "@/lib/team/feed";
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!input || typeof input.restaurantId !== "string" || typeof input.asOf !== "string") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    await markTeamFeedSeen(input.restaurantId, input.asOf);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof TeamAccessDenied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message === "Invalid visit time") return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
