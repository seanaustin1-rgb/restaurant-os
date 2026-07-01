import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { loadBrokerageAgentCockpitForUser } from "@/lib/modules/brokerage-analytics";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const agentId = url.searchParams.get("agentId");
  const user = await currentUser();
  const email =
    user?.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;

  const data = await loadBrokerageAgentCockpitForUser({
    clerkUserId: userId,
    userEmail: email,
    restaurantId,
    agentId,
  });

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
