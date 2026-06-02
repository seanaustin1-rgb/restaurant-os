import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadDashboardData } from "@/lib/dashboard/data";

// DEV ONLY: returns the computed dashboard JSON for a restaurant, so the live
// data pipeline can be verified without a browser/Clerk session.
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const url = new URL(req.url);
  let restaurantId = url.searchParams.get("restaurantId") ?? undefined;
  if (!restaurantId) {
    const first = await prisma.restaurant.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
    restaurantId = first?.id;
  }
  if (!restaurantId) {
    return NextResponse.json({ error: "no restaurant" }, { status: 404 });
  }
  const data = await loadDashboardData(restaurantId);
  return NextResponse.json(data);
}
