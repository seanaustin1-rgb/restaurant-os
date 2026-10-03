/** The middleware applies this to every signed-in page and API request. */
export function teamOnlyDestination(pathname: string, teamOnly: boolean): "allow" | "redirect" | "forbid" {
  if (!teamOnly || pathname === "/team" || pathname.startsWith("/team/") || pathname.startsWith("/api/team/")) {
    return "allow";
  }
  return pathname.startsWith("/api/") || pathname.startsWith("/trpc/") ? "forbid" : "redirect";
}

/** Never forward a session cookie to a request-supplied host. */
export function trustedTeamGuardUrl(requestUrl: string, appUrl?: string, vercelUrl?: string): URL | null {
  const requestOrigin = new URL(requestUrl).origin;
  const configured = [
    appUrl,
    vercelUrl ? `https://${vercelUrl}` : undefined,
  ];
  for (const candidate of configured) {
    if (!candidate) continue;
    try {
      const origin = new URL(candidate).origin;
      if (origin === requestOrigin) return new URL("/api/team/route-guard", origin);
    } catch { /* Ignore a malformed deployment setting. */ }
  }
  return null;
}
