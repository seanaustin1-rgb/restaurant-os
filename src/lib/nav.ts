// Shared primary navigation — used by both the global AppHeader (every page) and
// the dashboard's own header, so the link set never drifts between them.
export const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/access", label: "Access Paths" },
  { href: "/transactions", label: "Transactions" },
  { href: "/transactions/misc", label: "Review" },
  { href: "/onboarding/vendors", label: "Vendor Setup" },
  { href: "/settings/categories", label: "Categories" },
  { href: "/settings/rules", label: "Rules" },
  { href: "/settings/business", label: "Business Template" },
  { href: "/settings/sources", label: "Source Map" },
  { href: "/settings/allocation", label: "Allocation" },
  { href: "/settings/beverage", label: "Beverage" },
  { href: "/connections", label: "Connections" },
];
