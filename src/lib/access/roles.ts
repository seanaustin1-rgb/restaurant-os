import type { UserRole } from "@prisma/client";

export const OPERATOR_ROLES = ["OPERATOR"] as const satisfies readonly UserRole[];
export const SPIRIT_VAULT_STAFF_ROLES = ["OPERATOR", "MANAGER"] as const satisfies readonly UserRole[];
export const ADJUSTMENT_ROLES = ["OPERATOR", "MANAGER", "CONSULTANT"] as const satisfies readonly UserRole[];
/**
 * Roles that may view internal (non-curated) financial pages: /modules/*,
 * /connections, imports. INVESTOR is deliberately excluded — investors are
 * read-only and see only the curated /investor view.
 */
export const INTERNAL_VIEW_ROLES = ["OPERATOR", "MANAGER", "CONSULTANT"] as const satisfies readonly UserRole[];
export const DASHBOARD_ROLES = ["OPERATOR", "MANAGER", "CONSULTANT", "INVESTOR"] as const satisfies readonly UserRole[];

export function roleListLabel(roles: readonly UserRole[]): string {
  if (roles.includes("CONSULTANT")) return "operator, manager, or consultant/accountant";
  if (roles.includes("MANAGER")) return "operator or manager";
  if (roles.includes("INVESTOR")) return "authorized user";
  return "operator";
}
