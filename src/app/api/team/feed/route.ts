import { NextResponse } from "next/server";
import { TeamAccessDenied } from "@/lib/team/access";
import { loadTeamFeed } from "@/lib/team/feed";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const restaurantId = p.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });
  try {
    const result = await loadTeamFeed({ restaurantId, q: p.get("q") ?? undefined, category: p.get("category") ?? undefined,
      tag: p.get("tag") ?? undefined, cursor: p.get("cursor") ?? undefined, asOf: p.get("asOf") ?? undefined });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof TeamAccessDenied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message.startsWith("Invalid feed")) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
