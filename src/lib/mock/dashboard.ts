// Mock data for the dashboard shell — stands in until POS/Plaid feeds are wired.
import type { Taps } from "@/lib/profit-first/calculator";

export const DEFAULT_TAPS: Taps = {
  profitPct: 5,
  ownerPayPct: 5,
  cogsFoodPct: 18,
  cogsLiquorPct: 12,
  laborPct: 32,
  opexPct: 28,
};

export type RoleKey = "OPERATOR" | "CONSULTANT" | "INVESTOR" | "MANAGER";

export interface MockRestaurant {
  id: string;
  name: string;
  seatCount: number;
  hoursOpenMTD: number;
}

export const RESTAURANTS: MockRestaurant[] = [
  { id: "stone-grille", name: "Stone Grille & Taphouse", seatCount: 215, hoursOpenMTD: 390 },
  { id: "copper-crust", name: "Copper Crust Co.", seatCount: 38, hoursOpenMTD: 300 },
];

export interface MockMetrics {
  restaurantId: string;
  periodLabel: string;
  revenueMTD: number;
  foodSalesMTD: number;
  liquorSalesMTD: number;
  foodCogsMTD: number;
  liquorCogsMTD: number;
  beverageCogsMTD: number;
  laborCostMTD: number;
  coversMTD: number;
  checkCountMTD: number;
  // Last 7 days of covers for the sparkline
  coversSparkline: number[];
  // Allocation spend-to-date per TAP bucket (for the gauges)
  spend: {
    profit: number;
    ownerPay: number;
    cogsFood: number;
    cogsLiquor: number;
    labor: number;
    opex: number;
  };
}

export const METRICS: Record<string, MockMetrics> = {
  "stone-grille": {
    restaurantId: "stone-grille",
    periodLabel: "May 2026 · MTD",
    revenueMTD: 312450,
    foodSalesMTD: 196200,
    liquorSalesMTD: 116250,
    foodCogsMTD: 56240,
    liquorCogsMTD: 33180,
    beverageCogsMTD: 8900,
    laborCostMTD: 99980,
    coversMTD: 8420,
    checkCountMTD: 4120,
    coversSparkline: [280, 312, 261, 305, 338, 421, 392],
    spend: { profit: 8800, ownerPay: 11200, cogsFood: 56240, cogsLiquor: 33180, labor: 99980, opex: 61400 },
  },
  "copper-crust": {
    restaurantId: "copper-crust",
    periodLabel: "May 2026 · MTD",
    revenueMTD: 88200,
    foodSalesMTD: 79400,
    liquorSalesMTD: 8800,
    foodCogsMTD: 23900,
    liquorCogsMTD: 2400,
    beverageCogsMTD: 3100,
    laborCostMTD: 26100,
    coversMTD: 6100,
    checkCountMTD: 5450,
    coversSparkline: [180, 205, 198, 220, 240, 268, 252],
    spend: { profit: 2100, ownerPay: 2600, cogsFood: 23900, cogsLiquor: 2400, labor: 26100, opex: 15800 },
  },
};

export interface ModuleDef {
  key: string;
  name: string;
  description: string;
}

// The 8 modules the dashboard ships with.
export const DEFAULT_MODULES: ModuleDef[] = [
  { key: "cash-flow", name: "Cash Flow", description: "Daily inflows & outflows" },
  { key: "food-cost", name: "Food Cost Tracker", description: "COGS vs. theoretical" },
  { key: "labor", name: "Labor Optimizer", description: "Labor % vs. forecast" },
  { key: "sales-mix", name: "Sales Mix", description: "Category & item breakdown" },
  { key: "reviews", name: "Reputation", description: "Reviews across platforms" },
  { key: "vendors", name: "Vendor Spend", description: "Spend by supplier" },
  { key: "tax-vault", name: "Tax Vault", description: "Sales & payroll tax set-aside" },
  { key: "forecast", name: "Forecast", description: "13-week cash projection" },
];

// Modules available to add when one is removed.
export const ADDABLE_MODULES: ModuleDef[] = [
  { key: "menu-eng", name: "Menu Engineering", description: "Stars, dogs, plowhorses" },
  { key: "covers-flow", name: "Covers Flow", description: "Daypart pacing" },
  { key: "inventory", name: "Inventory", description: "On-hand & variance" },
  { key: "benchmarks", name: "Benchmarks", description: "Vs. peer concepts" },
];
