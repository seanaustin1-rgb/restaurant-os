import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestBoldTrailLead } from "@/lib/realestate/lead-webhook";

// BoldTrail Smart-Campaign webhook receiver (real-time lead push).
//
// Configure the campaign's Webhook action to POST here with the tenant + secret
// in the query string:
//   https://<app>/api/realestate/leads/boldtrail?tenant=<restaurantId>&secret=<secret>
//
// Auth for v1 is a shared secret (BOLDTRAIL_WEBHOOK_SECRET) — BoldTrail's exact
// signature scheme is TBD; firm this up with the Inside Real Estate rep. Public
// in middleware (Clerk can't authenticate a webhook). Acks fast; the alert +
// escalation fan-out runs async via Inngest.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  const secret = process.env.BOLDTRAIL_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const restaurantId = url.searchParams.get("tenant");
  if (!restaurantId) {
    return NextResponse.json({ error: "missing tenant" }, { status: 400 });
  }

  const tenant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { businessType: true },
  });
  if (!tenant || tenant.businessType !== "REAL_ESTATE_BROKERAGE") {
    return NextResponse.json({ error: "unknown tenant" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const result = await ingestBoldTrailLead(prisma, restaurantId, payload);
  return NextResponse.json({ ok: true, ...result });
}
