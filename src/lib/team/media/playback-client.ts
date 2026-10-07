/** Renew before expiry even when a phone resumes with an older, still-valid token. */
export function playbackRefreshDelay(expiresAt: string, now = Date.now()): number {
  const remaining = Date.parse(expiresAt) - now - 60000;
  return !Number.isFinite(remaining) || remaining <= 0 ? 0 : Math.min(55 * 60000, remaining);
}
