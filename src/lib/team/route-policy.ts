/** Decide without network or database access; pages still enforce their own roles. */
export function teamOnlyDestination(pathname: string, teamOnly: boolean, method = "GET"): "allow" | "redirect" | "forbid" {
  if (!teamOnly || pathname === "/team" || pathname.startsWith("/team/") || pathname.startsWith("/api/team/") ||
    /^\/(sign-in|sign-out|sign-up)(\/|$)/.test(pathname)) {
    return "allow";
  }
  // The exact invite page and its form POST need to be reachable before the
  // business role exists. acceptAccessInvite verifies the signed-in email.
  if (pathname === "/access/accept" && ["GET", "HEAD", "POST"].includes(method)) return "allow";
  return pathname.startsWith("/api/") || pathname.startsWith("/trpc/") || !["GET", "HEAD"].includes(method)
    ? "forbid"
    : "redirect";
}
