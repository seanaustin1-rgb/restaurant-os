import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher: () => () => false,
}));
vi.mock("@/lib/prisma", () => { throw new Error("Middleware must not import Prisma"); });

import middleware from "./middleware";

const handle = middleware as unknown as (
  auth: (() => Promise<{ userId: string; sessionClaims: { metadata?: { teamOnly?: boolean } } }>) & { protect: () => Promise<void> },
  request: NextRequest,
) => Promise<NextResponse | void>;

function viewer(teamOnly?: boolean) {
  return Object.assign(
    vi.fn().mockResolvedValue({ userId: "clerk_1", sessionClaims: teamOnly === undefined ? {} : { metadata: { teamOnly } } }),
    { protect: vi.fn().mockResolvedValue(undefined) },
  );
}

afterEach(() => vi.restoreAllMocks());

describe("Team-only middleware", () => {
  it("redirects a Team-only dashboard request and blocks a financial API and server action", async () => {
    const auth = viewer(true);
    const dashboard = await handle(auth, new NextRequest("https://app.example/dashboard"));
    expect(dashboard?.status).toBe(307);
    expect(dashboard?.headers.get("location")).toBe("https://app.example/team");

    const api = await handle(auth, new NextRequest("https://app.example/api/import/commit"));
    expect(api?.status).toBe(403);
    expect(await api?.json()).toEqual({ error: "Forbidden" });

    const action = await handle(auth, new NextRequest("https://app.example/dashboard", { method: "POST" }));
    expect(action?.status).toBe(403);
  });

  it("lets an owner through without a fetch or database import", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const auth = viewer(false);
    expect(await handle(auth, new NextRequest("https://app.example/dashboard"))).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("treats an absent claim as a normal user", async () => {
    const auth = viewer();
    expect(await handle(auth, new NextRequest("https://app.example/dashboard"))).toBeUndefined();
  });

  it("lets a Team-only user open and submit the exact business invite page", async () => {
    const auth = viewer(true);
    expect(await handle(auth, new NextRequest("https://app.example/access/accept?token=invite")))
      .toBeUndefined();
    expect(await handle(auth, new NextRequest("https://app.example/access/accept?token=invite", { method: "POST" })))
      .toBeUndefined();
    const other = await handle(auth, new NextRequest("https://app.example/access/other"));
    expect(other?.headers.get("location")).toBe("https://app.example/team");
  });
});
