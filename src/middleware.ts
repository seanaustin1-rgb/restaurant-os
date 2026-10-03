import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { teamOnlyDestination, trustedTeamGuardUrl } from "@/lib/team/route-policy";

// Public routes don't require authentication.
const isPublicRoute = createRouteMatcher([
  "/",
  "/privacy(.*)",
  "/profit-first(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Public Mode-2 instant-estimate demo (no login).
  "/demo(.*)",
  // Public "Live Heartbeat" marketing landing (no login).
  "/heartbeat(.*)",
  // Public guest Spirit Vault surfaces only. The day-code gate is enforced inside
  // these routes (physical-presence), not by Clerk. Kept deliberately NARROW — do
  // NOT broaden to /vault(.*): future authenticated guest-account/member routes
  // (e.g. /vault/account) must stay Clerk-protected by default. The staff placemat
  // (/vault/flights/[id]/placemat) additionally enforces its own staff-role check.
  "/vault",
  "/vault/flights(.*)",
  // Member sign-in + code redemption (the page is public; the redeem action is auth-gated).
  "/vault/join(.*)",
  // Day-code entry point that unlocks the vault for the day.
  "/v/(.*)",
  // Inngest authenticates via its signing key, not Clerk.
  "/api/inngest(.*)",
  // Dev-only helper routes (additionally guarded by NODE_ENV inside each handler).
  "/api/dev(.*)",
]);

// Dev-only helper routes — blocked entirely in production here, as defense in
// depth on top of each handler's own NODE_ENV guard (so a future dev route that
// forgets the guard still can't leak in prod).
const isDevRoute = createRouteMatcher(["/api/dev(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isDevRoute(req) && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  const pathname = req.nextUrl.pathname;
  if (pathname === "/api/team/route-guard") return;
  const { userId } = await auth();
  if (!userId) return;
  if (pathname === "/team" || pathname.startsWith("/team/") || pathname.startsWith("/api/team/")) return;
  // The server route uses the regular Node Prisma client and fresh DB state.
  // Never trust a client-supplied role claim for this boundary.
  const guardUrl = trustedTeamGuardUrl(req.url, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL);
  if (!guardUrl) return NextResponse.json({ error: "Access check unavailable" }, { status: 503 });
  let teamOnly: boolean;
  try {
    const response = await fetch(guardUrl, {
      headers: {
        cookie: req.headers.get("cookie") ?? "",
        ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Team route guard unavailable");
    const result = await response.json() as { teamOnly?: boolean };
    if (typeof result.teamOnly !== "boolean") throw new Error("Invalid Team route guard response");
    teamOnly = result.teamOnly;
  } catch {
    return NextResponse.json({ error: "Access check unavailable" }, { status: 503 });
  }
  const decision = teamOnlyDestination(pathname, teamOnly);
  if (decision === "forbid") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (decision === "redirect") return NextResponse.redirect(new URL("/team", req.url));
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
