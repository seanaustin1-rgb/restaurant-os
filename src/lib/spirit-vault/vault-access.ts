import { cookies } from "next/headers";
import { dayGateEnabled, isValidDayCode } from "./day-code";

// Server-only resolver for guest access to the digital vault. This is intentionally
// NOT a hard wall: access is granted by EITHER being on-site today (a valid day
// code, free) OR — in a future paid tier — a member with an off-premise
// entitlement. Keep both branches here so billing slots in without reworking gates.

export const DAY_COOKIE = "sv_day";

export type VaultAccess = { allowed: boolean; via: "open" | "day-code" | "member-offpremise" | null };

/**
 * @param providedCode a code from the request (e.g. `?k=` / path) to accept in
 * addition to the day cookie set by the /v entry route.
 */
export function resolveVaultAccess(providedCode?: string | null): VaultAccess {
  // Gate not configured yet → fail open so shipping never locks the live vault.
  if (!dayGateEnabled()) return { allowed: true, via: "open" };

  if (isValidDayCode(providedCode)) return { allowed: true, via: "day-code" };

  const cookieCode = cookies().get(DAY_COOKIE)?.value;
  if (isValidDayCode(cookieCode)) return { allowed: true, via: "day-code" };

  // FUTURE (paid tier): grant off-premise access to entitled members here, e.g.
  //   if (await memberHasOffPremiseEntitlement()) return { allowed: true, via: "member-offpremise" };

  return { allowed: false, via: null };
}
