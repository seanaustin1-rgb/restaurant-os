// Dashboard module registry — the real source of truth (replaces the mock list).
// "live" modules link to their page; "soon" modules render as honest, disabled
// tiles with the dependency that unblocks them, so nothing on the dashboard is a
// dead/fake control.
export type ModuleStatus = "live" | "soon";

export interface ModuleDef {
  key: string;
  name: string;
  description: string;
  status: ModuleStatus;
  href?: string; // for live modules
  blockedBy?: string; // short reason a "soon" module isn't ready yet
}

export const MODULES: ModuleDef[] = [
  { key: "cash-flow", name: "Cash Flow", description: "Daily inflows & outflows", status: "live", href: "/modules/cash-flow" },
  { key: "vendors", name: "Vendor Spend", description: "Spend by supplier", status: "live", href: "/modules/vendor-spend" },
  // Data-ready, queued next.
  { key: "tax-vault", name: "Tax Vault", description: "Sales & payroll tax set-aside", status: "soon", blockedBy: "Next up" },
  // Need Toast / POS item-level data.
  { key: "food-cost", name: "Food Cost Tracker", description: "COGS vs. theoretical", status: "soon", blockedBy: "Toast" },
  { key: "sales-mix", name: "Sales Mix", description: "Category & item breakdown", status: "soon", blockedBy: "Toast" },
  { key: "menu-eng", name: "Menu Engineering", description: "Stars, dogs, plowhorses", status: "soon", blockedBy: "Toast" },
  { key: "covers-flow", name: "Covers Flow", description: "Daypart pacing", status: "soon", blockedBy: "Toast" },
  // Need other inputs.
  { key: "labor", name: "Labor Optimizer", description: "Labor % vs. forecast", status: "soon", blockedBy: "Scheduling" },
  { key: "reviews", name: "Reputation", description: "Reviews across platforms", status: "soon", blockedBy: "Reviews API" },
  { key: "inventory", name: "Inventory", description: "On-hand & variance", status: "soon", blockedBy: "Inventory feed" },
  { key: "forecast", name: "Forecast", description: "13-week cash projection", status: "soon", blockedBy: "More history" },
  { key: "benchmarks", name: "Benchmarks", description: "Vs. peer concepts", status: "soon", blockedBy: "Peer data" },
];
