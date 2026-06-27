import type { UserRole } from "@prisma/client";

const ALL_ROLES: UserRole[] = ["OPERATOR", "MANAGER", "CONSULTANT", "INVESTOR"];
const ADJUSTMENT_ROLES: UserRole[] = ["OPERATOR", "MANAGER", "CONSULTANT"];
const OWNER_ROLES: UserRole[] = ["OPERATOR"];

// Shared primary navigation - used by both the global AppHeader and the
// dashboard header. Role metadata lets the dashboard menu stay focused.
export interface NavLink {
  href: string;
  label: string;
  roles: UserRole[];
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", roles: ALL_ROLES },
  { href: "/investor", label: "Investor Matrix", roles: ALL_ROLES },
  { href: "/access", label: "Access Paths", roles: ALL_ROLES },
  { href: "/transactions", label: "Transactions", roles: ADJUSTMENT_ROLES },
  { href: "/transactions/misc", label: "Review", roles: ADJUSTMENT_ROLES },
  { href: "/onboarding/vendors", label: "Vendor Setup", roles: ADJUSTMENT_ROLES },
  { href: "/settings/categories", label: "Categories", roles: ADJUSTMENT_ROLES },
  { href: "/settings/rules", label: "Rules", roles: ADJUSTMENT_ROLES },
  { href: "/settings/access", label: "Access", roles: OWNER_ROLES },
  { href: "/settings/business", label: "Business Template", roles: ADJUSTMENT_ROLES },
  { href: "/settings/sources", label: "Source Map", roles: ADJUSTMENT_ROLES },
  { href: "/settings/allocation", label: "Allocation", roles: ADJUSTMENT_ROLES },
  { href: "/settings/beverage", label: "Beverage", roles: ADJUSTMENT_ROLES },
  { href: "/connections", label: "Connections", roles: OWNER_ROLES },
];

export function navLinksForRoles(roles: readonly UserRole[]): NavLink[] {
  if (roles.length === 0) return NAV_LINKS;
  const allowed = new Set(roles);
  return NAV_LINKS.filter((link) => link.roles.some((role) => allowed.has(role)));
}
