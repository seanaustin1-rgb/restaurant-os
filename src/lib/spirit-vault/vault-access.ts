import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { dayGateEnabled, isValidDayCode } from "./day-code";
import { hasActiveMembership } from "./membership";

// Server-only resolver for guest access to the digital vault. Access is granted by
// ANY of: gate-not-configured (open), on-site today (a valid day code), or a member
// with an active entitlement at this venue (works on AND off premise). Tenant-aware
// and fail-closed on any membership lookup error.

export const DAY_COOKIE = "sv_day";

export type VaultAccess = { allowed: boolean; via: "open" | "day-code" | "member-offpremise" | null };

export async function resolveVaultAccess(opts: {
  restaurantId: string;
  providedCode?: string | null;
  clerkUserId?: string | null;
}): Promise<VaultAccess> {
  // Gate not configured yet → fail open so shipping never locks the live vault.
  if (!dayGateEnabled()) return { allowed: true, via: "open" };

  // On-site: today's code, provided directly or via the day cookie.
  if (isValidDayCode(opts.providedCode)) return { allowed: true, via: "day-code" };
  const cookieCode = cookies().get(DAY_COOKIE)?.value;
  if (isValidDayCode(cookieCode)) return { allowed: true, via: "day-code" };

  // Member tier: an active membership unlocks the vault anywhere, no day code needed.
  if (opts.clerkUserId) {
    try {
      if (await hasActiveMembership(prisma, opts.clerkUserId, opts.restaurantId)) {
        return { allowed: true, via: "member-offpremise" };
      }
    } catch {
      // Fail-closed: a lookup error must not grant access.
    }
  }

  return { allowed: false, via: null };
}
