import type { BusinessType } from "@prisma/client";

export type HeartbeatLensKey = "cash" | "discipline" | "pressure" | "momentum" | "aura";
export type ProfileFieldType = "text" | "number" | "select" | "boolean" | "percent" | "money";

export interface SeedAccount {
  key: string;
  name: string;
  targetPct: number;
}

export interface SectorTargets {
  targetPrimeCost?: number | null;
  targetFoodCost?: number | null;
  targetLiquorCost?: number | null;
  targetLaborCost?: number | null;
  targetLiquorPourPct?: number | null;
  targetBeveragePourPct?: number | null;
}

export interface ScaleAnchor {
  key: string;
  label: string;
  unit: string;
  helper?: string;
}

export interface ProfileQuestion {
  key: string;
  label: string;
  type: ProfileFieldType;
  options?: string[];
  defaultValue?: string | number | boolean;
  helper?: string;
  required?: boolean;
}

export interface IndustryTemplate {
  key: BusinessType;
  label: string;
  description: string;
  primarySetup: string;
  lenses: HeartbeatLensKey[];
  defaultModuleKeys: string[];
  scaleAnchor: ScaleAnchor;
  seedAccounts: SeedAccount[];
  defaultTargets: SectorTargets;
  profileQuestions: ProfileQuestion[];
}

export const INDUSTRY_TEMPLATES: Record<BusinessType, IndustryTemplate> = {
  RESTAURANT: {
    key: "RESTAURANT",
    label: "Restaurant / hospitality",
    description: "Prime cost, sales mix, labor, tax reserve, menu performance, and reputation signals.",
    primarySetup: "POS, bank, payroll, review platforms",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation",
      "go-live",
      "prime-cost",
      "cash-flow",
      "spending",
      "runway",
      "tax-vault",
      "sales-mix",
      "menu-eng",
      "covers-flow",
      "labor",
      "aura",
      "benchmarks",
    ],
    scaleAnchor: { key: "seatCount", label: "How many seats does the dining room have?", unit: "seats" },
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 5 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 5 },
      { key: "cogs_food", name: "COGS - Food", targetPct: 18 },
      { key: "cogs_liquor", name: "COGS - Liquor", targetPct: 12 },
      { key: "labor", name: "Labor", targetPct: 32 },
      { key: "opex", name: "OpEx + Spill", targetPct: 28 },
    ],
    defaultTargets: {
      targetPrimeCost: 60,
      targetFoodCost: 18,
      targetLiquorCost: 12,
      targetLaborCost: 32,
      targetLiquorPourPct: 20,
      targetBeveragePourPct: 24,
    },
    profileQuestions: [
      {
        key: "serviceModel",
        label: "Service model",
        type: "select",
        options: ["Full-service", "Quick-service / fast-casual", "Bar / nightlife", "Cafe / coffee", "Food truck", "Ghost kitchen"],
        required: true,
      },
      { key: "liquorSalesMixPct", label: "Alcohol as a % of sales (rough)", type: "percent", defaultValue: 25 },
      { key: "avgCheck", label: "Average check ($)", type: "money" },
      { key: "weeklyCovers", label: "Covers per week (rough)", type: "number" },
      { key: "collectsSalesTax", label: "Do you collect sales tax?", type: "boolean", defaultValue: true },
    ],
  },
  SERVICE: {
    key: "SERVICE",
    label: "Service business",
    description: "Cash runway, payroll load, recurring costs, job/client profitability, lead flow, and satisfaction.",
    primarySetup: "bank, accounting, payroll, CRM",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation",
      "go-live",
      "cash-flow",
      "spending",
      "category-trends",
      "recurring",
      "runway",
      "payment-watch",
      "benchmarks",
      "aura",
    ],
    scaleAnchor: { key: "activeClients", label: "About how many active clients do you serve?", unit: "clients" },
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 10 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 12 },
      { key: "labor", name: "Team / Payroll", targetPct: 38 },
      { key: "cogs_direct", name: "Direct Costs", targetPct: 8 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 7 },
      { key: "opex", name: "OpEx + Spill", targetPct: 25 },
    ],
    defaultTargets: { targetPrimeCost: 46, targetLaborCost: 38 },
    profileQuestions: [
      { key: "billingModel", label: "How do you mostly bill?", type: "select", options: ["Hourly", "Retainer / recurring", "Per-project / fixed-fee", "Mixed"], required: true },
      { key: "arTermsDays", label: "Typical payment terms (days)", type: "number", defaultValue: 30 },
      { key: "recurringRevenuePct", label: "% of revenue that is recurring", type: "percent" },
      { key: "billableUtilizationTarget", label: "Target billable utilization %", type: "percent", defaultValue: 65 },
    ],
  },
  CONTRACTOR: {
    key: "CONTRACTOR",
    label: "Contractor / field service",
    description: "Job margin, labor utilization, materials pressure, receivables, schedule capacity, and cash runway.",
    primarySetup: "bank, accounting, jobs, payroll",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation",
      "go-live",
      "cash-flow",
      "spending",
      "category-trends",
      "payment-watch",
      "runway",
      "job-margin",
      "recurring",
      "aura",
      "benchmarks",
    ],
    scaleAnchor: { key: "concurrentJobs", label: "How many jobs run at once, typically?", unit: "jobs" },
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 8 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 8 },
      { key: "cogs_materials", name: "Materials", targetPct: 30 },
      { key: "labor", name: "Field Labor", targetPct: 28 },
      { key: "cogs_subs", name: "Subcontractors", targetPct: 6 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 5 },
      { key: "opex", name: "OpEx + Spill", targetPct: 15 },
    ],
    defaultTargets: { targetPrimeCost: 64, targetLaborCost: 28 },
    profileQuestions: [
      { key: "trade", label: "Primary trade", type: "select", options: ["General", "HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping", "Remodel", "Other"], required: true },
      { key: "materialsVsLaborSplit", label: "Materials as a % of job cost (rough)", type: "percent", defaultValue: 50 },
      { key: "depositPct", label: "Typical deposit collected up front (%)", type: "percent", defaultValue: 30 },
      { key: "retainagePct", label: "Retainage held on contracts (%)", type: "percent", defaultValue: 0 },
      { key: "crewSize", label: "Field crew headcount", type: "number" },
    ],
  },
  REAL_ESTATE_BROKERAGE: {
    key: "REAL_ESTATE_BROKERAGE",
    label: "Real estate broker / agent team",
    description: "Commission pipeline, splits, lead ROI, tax reserves, deal margin, and referral/reputation momentum.",
    primarySetup: "accounting, bank, CRM, listings",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation",
      "go-live",
      "company-dollar",
      "cash-flow",
      "spending",
      "category-trends",
      "payment-watch",
      "runway",
      "commission-pipeline",
      "agent-performance",
      "market-intelligence",
      "lead-roi",
      "recurring",
      "aura",
      "benchmarks",
    ],
    scaleAnchor: { key: "agentCount", label: "How many agents are on the team?", unit: "agents" },
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 8 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 10 },
      { key: "agent_splits", name: "Agent Commission Splits", targetPct: 50 },
      { key: "labor", name: "Staff Payroll", targetPct: 8 },
      { key: "lead_marketing", name: "Lead Gen / Marketing", targetPct: 8 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 6 },
      { key: "opex", name: "OpEx + Spill", targetPct: 10 },
    ],
    defaultTargets: { targetPrimeCost: null, targetLaborCost: 8 },
    profileQuestions: [
      { key: "avgCommissionSplit", label: "Typical agent split (agent's %)", type: "percent", defaultValue: 70 },
      { key: "avgGci", label: "Average gross commission per deal ($)", type: "money" },
      { key: "monthlyLeadSpend", label: "Monthly lead-gen spend ($)", type: "money" },
      { key: "dealsPerYear", label: "Closings per year (team)", type: "number" },
      { key: "capModel", label: "Do agents have a cap?", type: "boolean", defaultValue: false },
    ],
  },
  VACATION_RENTAL: {
    key: "VACATION_RENTAL",
    label: "Vacation rental / property services",
    description: "Occupancy, booking pace, owner payouts, turn costs, platform fees, maintenance drag, and guest Aura.",
    primarySetup: "bank, booking, accounting, reviews",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation",
      "go-live",
      "cash-flow",
      "spending",
      "category-trends",
      "payment-watch",
      "runway",
      "property-heartbeat",
      "occupancy",
      "property-profit",
      "recurring",
      "aura",
      "benchmarks",
    ],
    scaleAnchor: { key: "unitCount", label: "How many units or properties do you operate?", unit: "units" },
    seedAccounts: [
      { key: "owner_payouts", name: "Owner Payouts", targetPct: 45 },
      { key: "cleaning_turnover", name: "Cleaning / Turnover", targetPct: 12 },
      { key: "platform_fees", name: "Platform Fees", targetPct: 6 },
      { key: "profit", name: "Profit", targetPct: 7 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 7 },
      { key: "tax_reserve", name: "Tax / Lodging Tax Reserve", targetPct: 5 },
      { key: "opex", name: "OpEx + Spill", targetPct: 18 },
    ],
    defaultTargets: { targetPrimeCost: null, targetLaborCost: 12 },
    profileQuestions: [
      { key: "ownershipModel", label: "Do you own the units or manage for owners?", type: "select", options: ["Manage for owners", "Own the units", "Mixed"], required: true },
      { key: "mgmtFeePct", label: "Management fee (% of booking revenue)", type: "percent", defaultValue: 20 },
      { key: "platformMix", label: "Main booking channel", type: "select", options: ["Airbnb", "VRBO", "Booking.com", "Direct", "Mixed"] },
      { key: "avgNightlyRate", label: "Average nightly rate ($)", type: "money" },
      { key: "targetOccupancyPct", label: "Target occupancy %", type: "percent", defaultValue: 65 },
    ],
  },
  RETAIL: {
    key: "RETAIL",
    label: "Retail",
    description: "Gross margin, cash runway, inventory pressure, returns, sell-through, traffic, and reviews.",
    primarySetup: "POS, bank, inventory, ecommerce/reviews",
    lenses: ["cash", "discipline", "pressure", "momentum", "aura"],
    defaultModuleKeys: [
      "allocation",
      "go-live",
      "cash-flow",
      "spending",
      "category-trends",
      "recurring",
      "runway",
      "inventory",
      "aura",
      "benchmarks",
    ],
    scaleAnchor: { key: "skuCount", label: "Roughly how many SKUs or departments?", unit: "SKUs" },
    seedAccounts: [
      { key: "profit", name: "Profit", targetPct: 6 },
      { key: "owner_pay", name: "Owner Pay", targetPct: 8 },
      { key: "cogs_inventory", name: "COGS - Inventory", targetPct: 45 },
      { key: "labor", name: "Labor", targetPct: 18 },
      { key: "tax_reserve", name: "Tax Reserve", targetPct: 5 },
      { key: "opex", name: "OpEx + Spill", targetPct: 18 },
    ],
    defaultTargets: { targetPrimeCost: 63, targetLaborCost: 18 },
    profileQuestions: [
      { key: "storefrontType", label: "Storefront type", type: "select", options: ["Brick-and-mortar", "E-commerce", "Both"], required: true },
      { key: "targetGrossMarginPct", label: "Target gross margin %", type: "percent", defaultValue: 45 },
      { key: "onlineSalesMixPct", label: "% of sales online", type: "percent" },
      { key: "returnRatePct", label: "Typical return rate %", type: "percent", defaultValue: 5 },
      { key: "inventoryMethod", label: "Inventory valuation", type: "select", options: ["FIFO", "Weighted average", "Not tracked"] },
    ],
  },
};

export function industryTemplateFor(type: BusinessType | null | undefined): IndustryTemplate {
  return INDUSTRY_TEMPLATES[type ?? "RESTAURANT"] ?? INDUSTRY_TEMPLATES.RESTAURANT;
}
