// Vacation-rental / short-term-rental Instant-Estimate compute core (public demo).
//
// Pure + client-safe: a few numbers a host/operator already knows → the tiles a
// vacation-rental owner actually thinks in. Unlike a restaurant P&L, the revenue
// engine is occupancy × ADR × doors, and the headline is OWNER PROCEEDS — what's
// left after the stack of pass-throughs (platform fee, management fee, cleaning,
// maintenance) that a generic estimator would never ask for.
//
// Honesty contract: a handful of averages can drive the portfolio read; per-property
// P&L, channel mix, and pricing leakage stay LOCKED (see VR_LOCKED_TILES).

import type { Health } from "@/lib/demo/estimate";

const DAYS_PER_MONTH = 30.44; // mean Gregorian month — available nights / door / month

// Profit First starting lanes, vacation-rental flavored: STRs need a capex/turnover
// reserve (furniture, appliances, refreshes) most P&Ls forget. Illustrative defaults.
const PF_PROFIT_PCT = 5;
const PF_OWNER_PAY_PCT = 10;
const PF_TAX_PCT = 8;
const PF_RESERVE_PCT = 5; // furnishing / capex reserve

export type VacationRentalPms = "escapia" | "guesty" | "hostaway" | "ownerrez" | "hospitable" | "airbnb_vrbo" | "spreadsheet" | "other";
export type Season = "typical" | "peak" | "slow";
export type AdrBasis = "gross" | "net";

export interface VacationRentalEstimateInputs {
  name: string;
  market: string;
  pms: VacationRentalPms;
  // Revenue engine (the only truly required numbers)
  properties: number; // doors
  adr: number; // $/night
  occupancyPct: number; // %
  adrBasis: AdrBasis; // is ADR what the guest pays (gross) or what hits your account (net)?
  season: Season; // labels the read; does NOT scale the entered numbers
  nightsPerMonth?: number | null; // available nights / door / month (default 30.44)
  // Cost stack (optional; each one sharpens the read)
  platformFeePct?: number | null; // Airbnb/VRBO take, % of gross booking revenue
  managementFeePct?: number | null; // PM fee, % of collected rent (0 = self-managed)
  cleaningMonthly?: number | null; // turn/cleaning cost net of guest-paid cleaning fees
  maintenanceMonthly?: number | null;
  utilitiesSuppliesMonthly?: number | null;
  monthlyFixedBills?: number | null; // insurance, PMS software, other fixed
}

export interface VrPfLine {
  key: string;
  label: string;
  pct: number;
  amount: number;
}

export interface VrBenchRow {
  key: string;
  label: string;
  value: number;
  typicalLow: number;
  typicalHigh: number;
  status: Health;
  note: string;
  scaleMax: number;
  lowerIsBetter: boolean;
  greenEdge: number;
  yellowEdge: number;
}

export interface VacationRentalEstimateResult {
  properties: number;
  season: Season;
  // Revenue engine
  adrGross: number;
  occupancyPct: number;
  revPar: number; // ADR × occupancy, gross, per available night
  bookedNightsPerMonth: number;
  grossBookingRevenue: number; // monthly, gross (what guests pay)
  revenueAfterPlatform: number; // monthly, after platform fee
  // The stack
  platformFee: number;
  managementFee: number;
  cleaning: number;
  maintenance: number;
  utilitiesSupplies: number;
  fixedBills: number;
  // Headline
  ownerProceeds: number; // monthly $ the owner keeps
  ownerProceedsPct: number; // of gross booking revenue
  ownerProceedsPerProperty: number;
  maintenanceDragPct: number;
  ownerProceedsHealth: Health;
  occupancyHealth: Health;
  maintenanceHealth: Health;
  // Break-even occupancy (the signature VR number)
  breakEvenOccupancyPct: number | null;
  marginOfSafetyPct: number; // revenue MoS
  breakEvenHealth: Health;
  // Self-managed vs managed insight (only when a PM fee was entered)
  managed: boolean;
  selfManagedOwnerProceeds: number;
  selfManagedOwnerProceedsPct: number;
  managementFeeMonthlyCost: number;
  // Profit First + cash flow
  pf: VrPfLine[];
  cashIn: number;
  cashOut: number;
  cashLeft: number;
  // Benchmarks
  bench: VrBenchRow[];
  benchOverall: Health;
  benchGreenCount: number;
  // Source pipe
  pms: VacationRentalPms;
  pmsLabel: string;
  pmsNote: string;
}

const PMS_LABELS: Record<VacationRentalPms, string> = {
  escapia: "Escapia",
  guesty: "Guesty",
  hostaway: "Hostaway",
  ownerrez: "OwnerRez",
  hospitable: "Hospitable",
  airbnb_vrbo: "Airbnb / VRBO direct",
  spreadsheet: "Spreadsheet / none",
  other: "Other PMS",
};

const PMS_NOTES: Record<VacationRentalPms, string> = {
  escapia: "Pilot source: API/export can start with property managers, units, rates, fees, taxes, restrictions, and channels; booking/profit fields depend on account access.",
  guesty: "Rich source: reservations, payouts, channel mix, cleaning tasks, and owner statements can roll in cleanly.",
  hostaway: "Strong for multi-channel hosts; reservations, financials, and automated tasks export well.",
  ownerrez: "Good for owner-operators; bookings, payments, owner statements, and expenses are accessible.",
  hospitable: "Useful for messaging-led hosts; pair its reservation data with bank/accounting for the money side.",
  airbnb_vrbo: "Channel exports give bookings and payouts; bank + accounting fill the cost stack the platforms hide.",
  spreadsheet: "Start with bookings, payouts, and a monthly cost list; a PMS later automates the per-property detail.",
  other: "Begin with reservations, payouts, cleaning, and maintenance; most PMS platforms export these.",
};

// The portfolio reads a few averages can't honestly drive — rendered locked in the UI.
export const VR_LOCKED_TILES: { key: string; label: string; needs: string }[] = [
  { key: "per-property", label: "Per-Property P&L", needs: "per-unit bookings + expenses" },
  { key: "channel-mix", label: "Channel Mix", needs: "Airbnb / VRBO / direct split" },
  { key: "pricing-gap", label: "Dynamic Pricing Gaps", needs: "rate + comp data" },
  { key: "cleaning-leak", label: "Cleaning Vendor Leakage", needs: "turn-level invoices" },
  { key: "owner-statements", label: "Owner Statements", needs: "per-owner ledgers" },
  { key: "damage-chargebacks", label: "Damage & Chargebacks", needs: "payment-dispute data" },
];

const clampPctVal = (v: number) => Math.max(0, Math.min(100, v));
const bandHigher = (v: number, green: number, yellow: number): Health => (v >= green ? "green" : v >= yellow ? "yellow" : "red");
const bandLower = (v: number, green: number, yellow: number): Health => (v <= green ? "green" : v <= yellow ? "yellow" : "red");
const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };

function proceedsNote(pct: number, status: Health): string {
  if (status === "green") return "healthy owner share vs. peers";
  if (status === "yellow") return "thin owner share — costs are heavy";
  return pct < 0 ? "running at a loss after costs" : "low owner share — the stack is eating it";
}
function occNote(value: number, status: Health): string {
  if (status === "green") return "strong demand vs. typical";
  if (status === "yellow") return "soft — watch rate and listing quality";
  return "low occupancy — pricing or demand problem";
}
function dragNote(value: number, status: Health): string {
  if (status === "green") return "maintenance in check";
  if (status === "yellow") return `${value.toFixed(1)}% of revenue — creeping up`;
  return `${value.toFixed(1)}% of revenue — high drag`;
}

export function computeVacationRentalEstimate(input: VacationRentalEstimateInputs): VacationRentalEstimateResult {
  const properties = Math.max(0, input.properties);
  const occupancyPct = clampPctVal(input.occupancyPct);
  const occ = occupancyPct / 100;
  const nights = input.nightsPerMonth && input.nightsPerMonth > 0 ? input.nightsPerMonth : DAYS_PER_MONTH;
  const platformRate = clampPctVal(input.platformFeePct ?? 0) / 100;
  const mgmtRate = clampPctVal(input.managementFeePct ?? 0) / 100;

  // Reconstruct a gross ADR so every output is consistent regardless of the basis
  // the operator entered. Net ADR = what hits the account = gross × (1 − platform).
  const adrGross = input.adrBasis === "net" && platformRate < 1 ? input.adr / (1 - platformRate) : input.adr;

  const capacityRevenue = properties * nights * adrGross; // gross revenue at 100% occupancy
  const bookedNightsPerMonth = properties * nights * occ;
  const grossBookingRevenue = adrGross * bookedNightsPerMonth;
  const platformFee = grossBookingRevenue * platformRate;
  const revenueAfterPlatform = grossBookingRevenue - platformFee;
  const managementFee = revenueAfterPlatform * mgmtRate;

  const cleaning = Math.max(0, input.cleaningMonthly ?? 0);
  const maintenance = Math.max(0, input.maintenanceMonthly ?? 0);
  const utilitiesSupplies = Math.max(0, input.utilitiesSuppliesMonthly ?? 0);
  const fixedBills = Math.max(0, input.monthlyFixedBills ?? 0);
  const fixedStack = cleaning + maintenance + utilitiesSupplies + fixedBills;

  const ownerProceeds = revenueAfterPlatform - managementFee - fixedStack;
  const ownerProceedsPct = grossBookingRevenue > 0 ? (ownerProceeds / grossBookingRevenue) * 100 : 0;
  const ownerProceedsPerProperty = properties > 0 ? ownerProceeds / properties : 0;
  const maintenanceDragPct = grossBookingRevenue > 0 ? (maintenance / grossBookingRevenue) * 100 : 0;
  const revPar = adrGross * occ;

  // Break-even occupancy: the % full needed to cover the fixed stack, given the
  // variable take (platform + management). Owner keeps gross×(1−plat)×(1−mgmt) − FC.
  const keepRate = (1 - platformRate) * (1 - mgmtRate);
  const grossBreakEven = keepRate > 0 ? fixedStack / keepRate : null;
  const breakEvenOccupancyPct = grossBreakEven != null && capacityRevenue > 0 ? clampPctVal((grossBreakEven / capacityRevenue) * 100) : null;
  const marginOfSafetyPct = grossBookingRevenue > 0 && grossBreakEven != null ? ((grossBookingRevenue - grossBreakEven) / grossBookingRevenue) * 100 : -100;

  // Self-managed vs managed: what the PM fee costs in owner proceeds.
  const managed = mgmtRate > 0;
  const selfManagedOwnerProceeds = revenueAfterPlatform - fixedStack;
  const selfManagedOwnerProceedsPct = grossBookingRevenue > 0 ? (selfManagedOwnerProceeds / grossBookingRevenue) * 100 : 0;

  // Profit First lanes off collected (after-platform) rent.
  const pfBase = revenueAfterPlatform;
  const pf: VrPfLine[] = [
    { key: "profit", label: "Profit", pct: PF_PROFIT_PCT, amount: (pfBase * PF_PROFIT_PCT) / 100 },
    { key: "owner", label: "Owner Pay", pct: PF_OWNER_PAY_PCT, amount: (pfBase * PF_OWNER_PAY_PCT) / 100 },
    { key: "tax", label: "Tax Reserve", pct: PF_TAX_PCT, amount: (pfBase * PF_TAX_PCT) / 100 },
    { key: "reserve", label: "Furnishing / Capex Reserve", pct: PF_RESERVE_PCT, amount: (pfBase * PF_RESERVE_PCT) / 100 },
  ];

  const cashIn = revenueAfterPlatform;
  const cashOut = managementFee + fixedStack;
  const cashLeft = cashIn - cashOut;

  const ownerProceedsHealth = bandHigher(ownerProceedsPct, 30, 18);
  const occupancyHealth = bandHigher(occupancyPct, 65, 50);
  const maintenanceHealth = bandLower(maintenanceDragPct, 6, 10);
  const breakEvenHealth = bandHigher(marginOfSafetyPct, 20, 10);

  // Benchmarks — static reference figures (not live peer data), clearly labeled in UI.
  const bench: VrBenchRow[] = [
    {
      key: "occupancy", label: "Occupancy", value: occupancyPct,
      typicalLow: 55, typicalHigh: 70, status: bandHigher(occupancyPct, 65, 50),
      scaleMax: 100, lowerIsBetter: false, greenEdge: 65, yellowEdge: 50,
      note: occNote(occupancyPct, bandHigher(occupancyPct, 65, 50)),
    },
    {
      key: "proceeds", label: "Owner Proceeds", value: ownerProceedsPct,
      typicalLow: 25, typicalHigh: 40, status: bandHigher(ownerProceedsPct, 30, 18),
      scaleMax: 60, lowerIsBetter: false, greenEdge: 30, yellowEdge: 18,
      note: proceedsNote(ownerProceedsPct, bandHigher(ownerProceedsPct, 30, 18)),
    },
    {
      key: "maintenance", label: "Maintenance Drag", value: maintenanceDragPct,
      typicalLow: 3, typicalHigh: 8, status: bandLower(maintenanceDragPct, 6, 10),
      scaleMax: 20, lowerIsBetter: true, greenEdge: 6, yellowEdge: 10,
      note: dragNote(maintenanceDragPct, bandLower(maintenanceDragPct, 6, 10)),
    },
  ];
  const benchOverall = bench.reduce<Health>((w, r) => (rank[r.status] > rank[w] ? r.status : w), "green");
  const benchGreenCount = bench.filter((r) => r.status === "green").length;

  return {
    properties,
    season: input.season,
    adrGross,
    occupancyPct,
    revPar,
    bookedNightsPerMonth,
    grossBookingRevenue,
    revenueAfterPlatform,
    platformFee,
    managementFee,
    cleaning,
    maintenance,
    utilitiesSupplies,
    fixedBills,
    ownerProceeds,
    ownerProceedsPct,
    ownerProceedsPerProperty,
    maintenanceDragPct,
    ownerProceedsHealth,
    occupancyHealth,
    maintenanceHealth,
    breakEvenOccupancyPct,
    marginOfSafetyPct,
    breakEvenHealth,
    managed,
    selfManagedOwnerProceeds,
    selfManagedOwnerProceedsPct,
    managementFeeMonthlyCost: managementFee,
    pf,
    cashIn,
    cashOut,
    cashLeft,
    bench,
    benchOverall,
    benchGreenCount,
    pms: input.pms,
    pmsLabel: PMS_LABELS[input.pms],
    pmsNote: PMS_NOTES[input.pms],
  };
}
