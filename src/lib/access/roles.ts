import type { UserRole } from "@prisma/client";

export const OPERATOR_ROLES = ["OPERATOR"] as const satisfies readonly UserRole[];
export const ADJUSTMENT_ROLES = ["OPERATOR", "MANAGER", "CONSULTANT"] as const satisfies readonly UserRole[];
export const BROKERAGE_LEADERSHIP_ROLES = ["OPERATOR", "MANAGER", "BROKER", "CONSULTANT"] as const satisfies readonly UserRole[];
export const DASHBOARD_ROLES = ["OPERATOR", "MANAGER", "BROKER", "CONSULTANT", "INVESTOR"] as const satisfies readonly UserRole[];

export function roleListLabel(roles: readonly UserRole[]): string {
  if (roles.includes("CONSULTANT")) return "operator, manager, or consultant/accountant";
  if (roles.includes("BROKER")) return "operator, manager, or broker";
  if (roles.includes("MANAGER")) return "operator or manager";
  if (roles.includes("INVESTOR")) return "authorized user";
  return "operator";
}
