import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
