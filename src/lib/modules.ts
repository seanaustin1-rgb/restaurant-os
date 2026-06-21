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
  { key: "allocation", name: "Allocation & Variance", description: "Profit First set-aside vs. actual", status: "live", href: "/modules/allocation" },
  { key: "go-live", name: "Go-Live Coach", description: "Virtual readiness before money moves", status: "live", href: "/modules/go-live" },
  { key: "prime-cost", name: "Prime Cost", description: "COGS + labor vs. target, by week", status: "live", href: "/modules/prime-cost" },
  { key: "break-even", name: "Break-even", description: "Sales needed to cover fixed costs", status: "live", href: "/modules/break-even" },
  { key: "processing-fees", name: "Processing Fee Leak", description: "Card fees vs. benchmark & creep", status: "live", href: "/modules/processing-fees" },
  { key: "cash-flow", name: "Cash Flow", description: "Daily inflows & outflows", status: "live", href: "/modules/cash-flow" },
  { key: "vendors", name: "Vendor Spend", description: "Spend by supplier", status: "live", href: "/modules/vendor-spend" },
  { key: "spending", name: "Spending by Category", description: "Where money goes vs. profit", status: "live", href: "/modules/spending" },
  { key: "category-trends", name: "Category Trends & Budgets", description: "MoM spend by category + budgets", status: "live", href: "/modules/category-trends" },
  { key: "recurring", name: "Recurring & Subscriptions", description: "Repeating charges & price creep", status: "live", href: "/modules/recurring" },
  { key: "runway", name: "Cash Runway", description: "Days of cash at current burn", status: "live", href: "/modules/cash-runway" },
  { key: "payment-watch", name: "Payment Watch", description: "Double-pays & off-norm charges", status: "live", href: "/modules/payment-watch" },
  // Sales tax collected = Toast Orders API (per-check tax), synced daily. Payroll
  // tax shows pulls that cleared; forward accrual still needs a payroll feed.
  { key: "tax-vault", name: "Tax Vault", description: "Sales & payroll tax set-aside", status: "live", href: "/modules/tax-vault" },
  // Need Toast / POS item-level data.
  { key: "food-cost", name: "Food Cost Tracker", description: "COGS vs. theoretical", status: "soon", blockedBy: "Toast" },
  { key: "sales-mix", name: "Sales Mix", description: "Net sales by revenue center", status: "live", href: "/modules/sales-mix" },
  { key: "menu-eng", name: "Menu Engineering", description: "Items by popularity & revenue", status: "live", href: "/modules/menu-eng" },
  { key: "covers-flow", name: "Covers Flow", description: "Daily guests, orders & avg check", status: "live", href: "/modules/covers-flow" },
  // Need other inputs.
  { key: "labor", name: "Labor Hours", description: "Actual hours, cost & sales/hour", status: "live", href: "/modules/labor" },
  // Aura — multi-source reputation. Live tile; each source (Google/Yelp/Facebook)
  // lights up the moment its API keys are set, otherwise shows a connect card.
  { key: "aura", name: "Aura — Reputation", description: "Reviews across Google, Yelp & Facebook", status: "live", href: "/modules/aura" },
  { key: "inventory", name: "Inventory", description: "On-hand & variance", status: "soon", blockedBy: "Inventory feed" },
  { key: "forecast", name: "Forecast", description: "13-week cash projection", status: "soon", blockedBy: "More history" },
  // Peer Benchmarks — operator ratios vs. industry reference ranges (static norms
  // today; swappable for live cohort percentiles when a peer dataset lands).
  { key: "benchmarks", name: "Peer Benchmarks", description: "Core ratios vs. industry ranges", status: "live", href: "/modules/benchmarks" },
];
