import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { bootstrapPilotBrokerage } from "@/lib/realestate/bootstrap-pilot";

// One-time, no-terminal pilot bring-up. Visit while signed in:
//   /api/realestate/dev/bootstrap?token=<PILOT_BOOTSTRAP_TOKEN>&name=<Brokerage Name>
//
// Creates a REAL_ESTATE_BROKERAGE tenant, attaches you as BROKER, links you to a
// BrokerageAgent, and seeds a small fictitious lead spread so both dashboards
// render. Idempotent — safe to hit more than once.
//
// Double-gated: (a) Clerk auth (must be signed in — this route is NOT public),
// and (b) a secret token that only the operator sets in the env. FAILS CLOSED:
// returns 503 when PILOT_BOOTSTRAP_TOKEN is unset, so it is inert in any
// environment where the operator hasn't deliberately enabled it. Delete the env
// var again after bring-up to close the door.
export async function GET(req: NextRequest) {
  const secret = process.env.PILOT_BOOTSTRAP_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "bootstrap not enabled" }, { status: 503 });
  }
  const url = new URL(req.url);
  const provided = req.headers.get("x-bootstrap-token") ?? url.searchParams.get("token");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "sign in first, then re-open this URL" }, { status: 401 });
  }

  const user = await currentUser();
  const agentName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "Pilot Agent";
  const brokerageName = url.searchParams.get("name")?.trim() || "Pilot Brokerage";

  const result = await bootstrapPilotBrokerage(prisma, {
    clerkUserId: userId,
    agentName,
    brokerageName,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    next: {
      broker: "/realestate/broker",
      agent: "/realestate/agent",
    },
    reminder: "Remove PILOT_BOOTSTRAP_TOKEN from the env once you're set up.",
  });
}
