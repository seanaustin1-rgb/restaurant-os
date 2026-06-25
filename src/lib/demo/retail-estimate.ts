import type { Health } from "@/lib/demo/estimate";

const WEEKS_PER_MONTH = 4.33;
const PF_PROFIT_PCT = 5;
const PF_OWNER_PAY_PCT = 8;
const PF_TAX_PCT = 6;

export type RetailPosProvider = "square" | "clover" | "shopify" | "lightspeed" | "helcim" | "godaddy" | "revel" | "other";

export type RetailSeason = "typical" | "peak" | "slow";

// The reads a few averages can't honestly drive — rendered locked in the UI.
export const RETAIL_LOCKED_TILES: { key: string; label: string; needs: string }[] = [
  { key: "per-sku", label: "Per-SKU Margin", needs: "item-level POS data" },
  { key: "sell-through", label: "Sell-Through by Category", needs: "inventory + sales by item" },
  { key: "shrink", label: "Shrink / Theft", needs: "physical counts vs. system" },
  { key: "vendor-terms", label: "Vendor Terms & Spend", needs: "purchase-order history" },
  { key: "basket", label: "Basket / Attach Rate", needs: "transaction-line data" },
  { key: "channel", label: "Channel Profitability", needs: "in-store vs. online split" },
];

export interface RetailEstimateInputs {
  name: string;
  market: string;
  posProvider: RetailPosProvider;
  season: RetailSeason;
  weeklySales: number;
  weeklyInventoryPurchases: number;
  weeklyPayroll: number;
  weeklyReturnsMarkdowns: number;
  monthlyFixedBills: number;
  currentInventoryValue?: number | null;
  ecommerceSharePct?: number | null;
}

export interface RetailPfLine {
  key: string;
  label: string;
  pct: number;
  amount: number;
}

export interface RetailEstimateResult {
  monthlySales: number;
  weeklySales: number;
  monthlyInventoryPurchases: number;
  monthlyPayroll: number;
  monthlyReturnsMarkdowns: number;
  monthlyFixedBills: number;
  grossMarginPct: number;
  marginPressurePct: number;
  payrollPct: number;
  netProfit: number;
  netMarginPct: number;
  monthlyBreakEven: number;
  weeklyBreakEven: number;
  dollarsAboveBreakEven: number;
  marginOfSafetyPct: number;
  inventoryWeeksOnHand: number | null;
  ecommerceSharePct: number | null;
  posProvider: RetailPosProvider;
  posLabel: string;
  posNote: string;
  season: RetailSeason;
  marginHealth: Health;
  payrollHealth: Health;
  breakEvenHealth: Health;
  inventoryHealth: Health;
  pf: RetailPfLine[];
}

const POS_LABELS: Record<RetailPosProvider, string> = {
  square: "Square",
  clover: "Clover",
  shopify: "Shopify POS",
  lightspeed: "Lightspeed",
  helcim: "Helcim",
  godaddy: "GoDaddy POS",
  revel: "Revel",
  other: "Other POS",
};

const POS_NOTES: Record<RetailPosProvider, string> = {
  square: "Usually strong for small retail sellers, simple payments, item sales, and basic inventory exports.",
  clover: "Common with Fiserv merchant accounts; useful for in-store sales, tenders, employees, and inventory add-ons.",
  shopify: "Best when online and in-store sales need to roll into one channel and inventory picture.",
  lightspeed: "Often used by inventory-heavy retailers that need item, vendor, purchase order, and multi-location detail.",
  helcim: "Useful for lower-cost payments and simple selling workflows where exports may be enough at first.",
  godaddy: "Useful for simple retail and service counters that want basic selling with lightweight ecommerce.",
  revel: "More common in complex counter-service, specialty retail, and multi-location environments.",
  other: "Start with sales, tenders, refunds, item/category sales, and inventory exports from whatever POS is in place.",
};

const healthLower = (value: number, green: number, yellow: number): Health =>
  value <= green ? "green" : value <= yellow ? "yellow" : "red";

const healthHigher = (value: number, green: number, yellow: number): Health =>
  value >= green ? "green" : value >= yellow ? "yellow" : "red";

export function computeRetailEstimate(input: RetailEstimateInputs): RetailEstimateResult {
  const weeklySales = Math.max(0, input.weeklySales);
  const monthlySales = weeklySales * WEEKS_PER_MONTH;
  const monthlyInventoryPurchases = Math.max(0, input.weeklyInventoryPurchases) * WEEKS_PER_MONTH;
  const monthlyPayroll = Math.max(0, input.weeklyPayroll) * WEEKS_PER_MONTH;
  const monthlyReturnsMarkdowns = Math.max(0, input.weeklyReturnsMarkdowns) * WEEKS_PER_MONTH;
  const monthlyFixedBills = Math.max(0, input.monthlyFixedBills);
  const currentInventoryValue = input.currentInventoryValue && input.currentInventoryValue > 0 ? input.currentInventoryValue : null;
  const ecommerceSharePct = input.ecommerceSharePct != null && input.ecommerceSharePct >= 0 ? input.ecommerceSharePct : null;

  const marginPressureDollars = monthlyInventoryPurchases + monthlyReturnsMarkdowns;
  const marginPressurePct = monthlySales > 0 ? (marginPressureDollars / monthlySales) * 100 : 0;
  const grossMarginPct = monthlySales > 0 ? ((monthlySales - marginPressureDollars) / monthlySales) * 100 : 0;
  const payrollPct = monthlySales > 0 ? (monthlyPayroll / monthlySales) * 100 : 0;
  const monthlyBreakEven = marginPressureDollars + monthlyPayroll + monthlyFixedBills;
  const weeklyBreakEven = monthlyBreakEven / WEEKS_PER_MONTH;
  const dollarsAboveBreakEven = monthlySales - monthlyBreakEven;
  const marginOfSafetyPct = monthlySales > 0 ? (dollarsAboveBreakEven / monthlySales) * 100 : -100;
  const netProfit = dollarsAboveBreakEven;
  const netMarginPct = monthlySales > 0 ? (netProfit / monthlySales) * 100 : 0;
  const inventoryWeeksOnHand = currentInventoryValue && input.weeklyInventoryPurchases > 0 ? currentInventoryValue / input.weeklyInventoryPurchases : null;

  return {
    monthlySales,
    weeklySales,
    monthlyInventoryPurchases,
    monthlyPayroll,
    monthlyReturnsMarkdowns,
    monthlyFixedBills,
    grossMarginPct,
    marginPressurePct,
    payrollPct,
    netProfit,
    netMarginPct,
    monthlyBreakEven,
    weeklyBreakEven,
    dollarsAboveBreakEven,
    marginOfSafetyPct,
    inventoryWeeksOnHand,
    ecommerceSharePct,
    posProvider: input.posProvider,
    posLabel: POS_LABELS[input.posProvider],
    posNote: POS_NOTES[input.posProvider],
    season: input.season,
    marginHealth: healthHigher(grossMarginPct, 45, 35),
    payrollHealth: healthLower(payrollPct, 18, 24),
    breakEvenHealth: healthHigher(marginOfSafetyPct, 20, 10),
    inventoryHealth: inventoryWeeksOnHand == null ? "yellow" : inventoryWeeksOnHand <= 10 ? "green" : inventoryWeeksOnHand <= 16 ? "yellow" : "red",
    pf: [
      { key: "profit", label: "Profit", pct: PF_PROFIT_PCT, amount: (monthlySales * PF_PROFIT_PCT) / 100 },
      { key: "owner", label: "Owner Pay", pct: PF_OWNER_PAY_PCT, amount: (monthlySales * PF_OWNER_PAY_PCT) / 100 },
      { key: "tax", label: "Tax Reserve", pct: PF_TAX_PCT, amount: (monthlySales * PF_TAX_PCT) / 100 },
    ],
  };
}
