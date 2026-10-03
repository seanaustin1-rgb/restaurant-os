/** Decide without network or database access; pages still enforce their own roles. */
export function teamOnlyDestination(pathname: string, teamOnly: boolean, method = "GET"): "allow" | "redirect" | "forbid" {
  if (!teamOnly || pathname === "/team" || pathname.startsWith("/team/") || pathname.startsWith("/api/team/") ||
    /^\/(sign-in|sign-out|sign-up)(\/|$)/.test(pathname)) {
    return "allow";
  }
  return pathname.startsWith("/api/") || pathname.startsWith("/trpc/") || !["GET", "HEAD"].includes(method)
    ? "forbid"
    : "redirect";
}
