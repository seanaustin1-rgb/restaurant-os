import { NextResponse } from "next/server";
import { isTeamOnlyUser } from "@/lib/team/tenants";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ teamOnly: await isTeamOnlyUser() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
