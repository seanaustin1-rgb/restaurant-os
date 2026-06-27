import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import {
  discoverGoogleBusinessProfileLocations,
  exchangeGoogleCode,
  GOOGLE_BUSINESS_PROFILE_CATEGORY,
  GOOGLE_BUSINESS_PROFILE_PROVIDER,
} from "@/lib/integrations/google-business-profile/oauth";

const STATE_COOKIE = "gbp_oauth_state";

function appUrl(path: string): URL {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

function parseState(value: string | null): { nonce: string; restaurantId: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { nonce?: string; restaurantId?: string };
    return parsed.nonce && parsed.restaurantId ? { nonce: parsed.nonce, restaurantId: parsed.restaurantId } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(appUrl("/sign-in"));

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return NextResponse.redirect(appUrl(`/settings/sources?google=error&reason=${encodeURIComponent(error)}`));

  const state = parseState(url.searchParams.get("state"));
  const expectedNonce = req.cookies.get(STATE_COOKIE)?.value;
  if (!state || !expectedNonce || state.nonce !== expectedNonce) {
    return NextResponse.redirect(appUrl("/settings/sources?google=error&reason=state"));
  }

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, restaurantId: state.restaurantId, role: "OPERATOR" },
    select: { restaurantId: true },
  });
  if (!role) return NextResponse.redirect(appUrl("/dashboard"));

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(appUrl("/settings/sources?google=error&reason=missing_code"));

  try {
    const token = await exchangeGoogleCode(code);
    const locations = await discoverGoogleBusinessProfileLocations(token.access_token!);
    const location = locations.length === 1 ? locations[0] : null;
    const pendingLocationId = locations.length > 1 ? "pending" : "unselected";
    const connectionLocationId = location?.locationId ?? pendingLocationId;
    const status = location ? "CONNECTED" : "BLOCKED";
    const notes = location
      ? `Authorized Google Business Profile: ${location.title}${location.address ? ` (${location.address})` : ""}`
      : locations.length > 1
        ? `Google authorized. Choose one of ${locations.length} Business Profile locations.`
        : "Google authorized, but no Business Profile location was found.";

    await prisma.integrationConnection.upsert({
      where: {
        restaurantId_provider_externalLocationId: {
          restaurantId: role.restaurantId,
          provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
          externalLocationId: connectionLocationId,
        },
      },
      update: {
        category: GOOGLE_BUSINESS_PROFILE_CATEGORY,
        externalAccountId: location?.accountId ?? null,
        displayName: location?.title ?? "Google Business Profile",
        externalLocationId: connectionLocationId,
        accessToken: encrypt(token.access_token!),
        refreshToken: token.refresh_token ? encrypt(token.refresh_token) : undefined,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scopes: token.scope ?? null,
        metadata: { locations } as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
      create: {
        restaurantId: role.restaurantId,
        provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
        category: GOOGLE_BUSINESS_PROFILE_CATEGORY,
        externalAccountId: location?.accountId ?? null,
        externalLocationId: connectionLocationId,
        displayName: location?.title ?? "Google Business Profile",
        accessToken: encrypt(token.access_token!),
        refreshToken: token.refresh_token ? encrypt(token.refresh_token) : null,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scopes: token.scope ?? null,
        metadata: { locations } as unknown as Prisma.InputJsonValue,
      },
    });

    await prisma.dataSourceConfig.upsert({
      where: {
        restaurantId_category_providerName: {
          restaurantId: role.restaurantId,
          category: "aura",
          providerName: "Google Business Profile",
        },
      },
      update: {
        status,
        notes,
        updatedBy: userId,
      },
      create: {
        restaurantId: role.restaurantId,
        category: "aura",
        providerName: "Google Business Profile",
        status,
        notes,
        updatedBy: userId,
      },
    });

    const googleStatus = location ? "connected" : locations.length > 1 ? "choose_location" : "needs_location";
    const res = NextResponse.redirect(appUrl(`/settings/sources?google=${googleStatus}`));
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    const reason = encodeURIComponent(err instanceof Error ? err.message : "callback_failed");
    const res = NextResponse.redirect(appUrl(`/settings/sources?google=error&reason=${reason}`));
    res.cookies.delete(STATE_COOKIE);
    return res;
  }
}
