import type { BusinessType, UserRole } from "@prisma/client";

const ALL_ROLES: UserRole[] = ["OPERATOR", "MANAGER", "CONSULTANT", "INVESTOR"];
const ADJUSTMENT_ROLES: UserRole[] = ["OPERATOR", "MANAGER", "CONSULTANT"];
const OWNER_ROLES: UserRole[] = ["OPERATOR"];

// Shared primary navigation - used by both the global AppHeader and the
// dashboard header. Role metadata lets the dashboard menu stay focused.
export interface NavLink {
  href: string;
  label: string;
  roles: UserRole[];
  // When set, the link only shows for tenants of these business types (e.g. the
  // brokerage cockpits for a real-estate broker). Omit for universal links.
  businessTypes?: BusinessType[];
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", roles: ALL_ROLES },
  { href: "/morning-brief", label: "Morning Brief", roles: OWNER_ROLES },
  { href: "/modules/brokerage", label: "Brokerage", roles: ALL_ROLES, businessTypes: ["REAL_ESTATE_BROKERAGE"] },
  // Executive Cockpit is leadership-only (locked decision 7): it renders the named
  // per-agent leaderboard, which INVESTOR must never see.
  { href: "/modules/brokerage/cockpit", label: "Executive Cockpit", roles: ADJUSTMENT_ROLES, businessTypes: ["REAL_ESTATE_BROKERAGE"] },
  { href: "/modules/brokerage/agent-cockpit", label: "Agent Cockpit", roles: ALL_ROLES, businessTypes: ["REAL_ESTATE_BROKERAGE"] },
  { href: "/modules/rentals/cockpit", label: "Property Cockpit", roles: ALL_ROLES, businessTypes: ["VACATION_RENTAL"] },
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
  { href: "/settings/allocation", label: "Allocation", roles: ADJUSTMENT_ROLES, businessTypes: ["RESTAURANT"] },
  { href: "/settings/beverage", label: "Beverage", roles: ADJUSTMENT_ROLES, businessTypes: ["RESTAURANT"] },
  { href: "/connections", label: "Connections", roles: OWNER_ROLES },
];

// Filter the nav by the viewer's roles and the business types they operate.
// `businessTypes` is the union of types across the user's tenants; a
// vertical-specific link shows if the user has at least one matching tenant.
// Passing no `businessTypes` (or an empty set) skips business-type filtering,
// preserving the prior role-only behavior.
export function navLinksForRoles(
  roles: readonly UserRole[],
  businessTypes?: readonly BusinessType[],
): NavLink[] {
  const allowedRoles = roles.length === 0 ? null : new Set(roles);
  const allowedTypes = businessTypes && businessTypes.length > 0 ? new Set(businessTypes) : null;
  return NAV_LINKS.filter((link) => {
    const roleOk = !allowedRoles || link.roles.some((role) => allowedRoles.has(role));
    const typeOk = !link.businessTypes || !allowedTypes || link.businessTypes.some((type) => allowedTypes.has(type));
    return roleOk && typeOk;
  });
}
