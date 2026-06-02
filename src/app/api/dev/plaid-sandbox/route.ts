import { NextResponse } from "next/server";
import { createSandboxConnection } from "@/lib/plaid/sandbox";

// DEV ONLY: links a Plaid sandbox bank to a restaurant for testing the sync.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}) as { restaurantId?: string });
  try {
    const result = await createSandboxConnection(body.restaurantId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
