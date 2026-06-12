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
  { key: "spending", name: "Spending by Category", description: "Where money goes vs. profit", status: "live", href: "/modules/spending" },
  { key: "recurring", name: "Recurring & Subscriptions", description: "Repeating charges & price creep", status: "live", href: "/modules/recurring" },
  { key: "runway", name: "Cash Runway", description: "Days of cash at current burn", status: "live", href: "/modules/cash-runway" },
  { key: "payment-watch", name: "Payment Watch", description: "Double-pays & off-norm charges", status: "live", href: "/modules/payment-watch" },
  // Needs real reported figures, not estimates: collected sales tax from the
  // Toast sales report + payroll tax withheld per pay run from payroll/accounting.
  { key: "tax-vault", name: "Tax Vault", description: "Sales & payroll tax set-aside", status: "soon", blockedBy: "Toast + payroll" },
  // Need Toast / POS item-level data.
  { key: "food-cost", name: "Food Cost Tracker", description: "COGS vs. theoretical", status: "soon", blockedBy: "Toast" },
  { key: "sales-mix", name: "Sales Mix", description: "Net sales by revenue center", status: "live", href: "/modules/sales-mix" },
  { key: "menu-eng", name: "Menu Engineering", description: "Items by popularity & revenue", status: "live", href: "/modules/menu-eng" },
  { key: "covers-flow", name: "Covers Flow", description: "Daily guests, orders & avg check", status: "live", href: "/modules/covers-flow" },
  // Need other inputs.
  { key: "labor", name: "Labor Hours", description: "Actual hours, cost & sales/hour", status: "live", href: "/modules/labor" },
  { key: "reviews", name: "Reputation", description: "Reviews across platforms", status: "soon", blockedBy: "Reviews API" },
  { key: "inventory", name: "Inventory", description: "On-hand & variance", status: "soon", blockedBy: "Inventory feed" },
  { key: "forecast", name: "Forecast", description: "13-week cash projection", status: "soon", blockedBy: "More history" },
  { key: "benchmarks", name: "Benchmarks", description: "Vs. peer concepts", status: "soon", blockedBy: "Peer data" },
];
