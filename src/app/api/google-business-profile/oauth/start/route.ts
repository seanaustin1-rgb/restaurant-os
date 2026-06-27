import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { googleBusinessProfileAuthUrl } from "@/lib/integrations/google-business-profile/oauth";

const STATE_COOKIE = "gbp_oauth_state";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL));

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "CONSULTANT", "MANAGER"] } },
    select: { restaurantId: true },
  });
  if (!role) return NextResponse.redirect(new URL("/dashboard", process.env.NEXT_PUBLIC_APP_URL));

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ nonce, restaurantId: role.restaurantId })).toString("base64url");
  const res = NextResponse.redirect(googleBusinessProfileAuthUrl(state));
  res.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}
