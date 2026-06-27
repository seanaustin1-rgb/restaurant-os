import type { UserRole } from "@prisma/client";

export function landingPathForRole(role: UserRole): string {
  if (role === "INVESTOR") return "/investor";
  return "/onboarding";
}
