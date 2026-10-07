/** Only same-origin Team links may override Clerk's normal return destination. */
export function teamReturnPath(value: unknown, base: string): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value, base);
    if (url.origin !== new URL(base).origin || !(url.pathname === "/team" || url.pathname.startsWith("/team/"))) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return undefined; }
}
