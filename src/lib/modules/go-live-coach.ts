import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateTargets, getHealthStatus, type HealthStatus, type Taps } from "@/lib/profit-first/calculator";

const n = (v: unknown): number => (v == null ? 0 : Number(v));
const r2 = (v: number): number => Math.round(v * 100) / 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DEFAULT_TAPS: Taps = {
  profitPct: 5,
  ownerPayPct: 5,
  cogsFoodPct: 18,
  cogsLiquorPct: 12,
  laborPct: 32,
  opexPct: 28,
};

export const GO_LIVE_MODULE_KEY = "go-live";
const DEFAULT_PILOT_PROFIT_PCT = 1;
const DEFAULT_INVESTOR_RETURN_PCT = 0;

export type GoLiveStage = "observe" | "simulate" | "coach" | "pilot_ready" | "enforce_ready";
export type BucketKind = "reserve" | "accrue" | "drawdown";

export interface GoLiveBucket {
  key: string;
  label: string;
  kind: BucketKind;
  target: number;
  actual: number;
  gap: number;
  usagePct: number | null;
  signal: HealthStatus;
  ready: boolean;
  note: string;
}

export interface GoLiveCheck {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
}

export type PilotMode = "virtual" | "pilot_candidate" | "not_ready";

export interface PilotStep {
  key: string;
  label: string;
  mode: PilotMode;
  amount: number | null;
  detail: string;
}

export interface CashSafety {
  hasAnchor: boolean;
  currentCash: number | null;
  minimumOperatingCash: number | null;
  pilotSetAside: number;
  cushionAfterPilot: number | null;
  ready: boolean;
  detail: string;
}

export interface GoLiveAssumptions {
  operatingCashFloor: number | null;
  operatingCashFloorSource: "auto" | "manual";
  pilotProfitPct: number;
  investorReturnPct: number;
}

export interface DecisionLine {
  key: string;
  label: string;
  verdict: "go" | "wait" | "watch";
  detail: string;
}

export interface GoLiveCoachInput {
  periodLabel: string;
  salesDays: number;
  netSales: number;
  transactionCount: number;
  categorizedTransactionCount: number;
  salesTaxCollected: number;
  salesTaxCleared: number;
  taps: Taps;
  spendByTap: Record<string, number>;
  currentCash?: number | null;
  minimumOperatingCash?: number | null;
  assumptions?: Partial<GoLiveAssumptions>;
}

export interface GoLiveCoachData {
  periodLabel: string;
  hasData: boolean;
  stage: GoLiveStage;
  stageLabel: string;
  stageNote: string;
  recommendation: string;
  summary: string;
  netSales: number;
  salesDays: number;
  transactionCount: number;
  categorizationCoveragePct: number;
  buckets: GoLiveBucket[];
  shortfalls: GoLiveBucket[];
  checks: GoLiveCheck[];
  pilotPlan: PilotStep[];
  cashSafety: CashSafety;
  decisions: DecisionLine[];
  assumptions: GoLiveAssumptions;
}

function stageLabel(stage: GoLiveStage): string {
  switch (stage) {
    case "observe":
      return "Observe";
    case "simulate":
      return "Simulate";
    case "coach":
      return "Coach";
    case "pilot_ready":
      return "Pilot ready";
    case "enforce_ready":
      return "Full go-live ready";
  }
}

function stageNote(stage: GoLiveStage): string {
  switch (stage) {
    case "observe":
      return "Connect and sync enough data to see the business heartbeat.";
    case "simulate":
      return "Profit First is running virtually while more history builds.";
    case "coach":
      return "The model is useful now: fix the shortfalls before any real account setup.";
    case "pilot_ready":
      return "The virtual model is stable enough to rehearse a narrow pilot before any real transfers are enabled.";
    case "enforce_ready":
      return "The model is stable enough to design the second onboarding for real account routing.";
  }
}

function drawdownBucket(key: string, label: string, target: number, actual: number, note: string): GoLiveBucket {
  const usagePct = target > 0 ? (actual / target) * 100 : actual > 0 ? 999 : 0;
  const signal = target <= 0 && actual > 0 ? "red" : getHealthStatus(usagePct);
  const gap = target - actual;
  return {
    key,
    label,
    kind: "drawdown",
    target: r2(target),
    actual: r2(actual),
    gap: r2(gap),
    usagePct: target > 0 ? r2(usagePct) : null,
    signal,
    ready: signal !== "red",
    note,
  };
}

function accrueBucket(key: string, label: string, target: number, note: string): GoLiveBucket {
  const ready = target > 0;
  return {
    key,
    label,
    kind: "accrue",
    target: r2(target),
    actual: 0,
    gap: r2(target),
    usagePct: null,
    signal: ready ? "green" : "yellow",
    ready,
    note,
  };
}

function buildPilotPlan(stage: GoLiveStage, buckets: GoLiveBucket[], assumptions: GoLiveAssumptions, netSales: number): PilotStep[] {
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const canPilot = stage === "pilot_ready" || stage === "enforce_ready";
  const taxReady = byKey.get("tax-reserve")?.ready === true;
  const profitReady = byKey.get("profit")?.ready === true && buckets.every((b) => b.signal !== "red");
  const tax = byKey.get("tax-reserve");
  const profitAmount = Math.max(0, netSales * (assumptions.pilotProfitPct / 100));
  const investorAmount = Math.max(0, netSales * (assumptions.investorReturnPct / 100));

  return [
    {
      key: "tax-reserve",
      label: "Tax Reserve",
      mode: canPilot && taxReady ? "pilot_candidate" : taxReady ? "virtual" : "not_ready",
      amount: taxReady ? Math.max(0, tax?.gap ?? 0) : null,
      detail: taxReady
        ? "First virtual pilot candidate because tax is a liability, not spendable cash."
        : "Needs collected tax sync before it can pilot.",
    },
    {
      key: "profit",
      label: "Profit skim",
      mode: canPilot && profitReady ? "pilot_candidate" : profitReady ? "virtual" : "not_ready",
      amount: profitReady ? profitAmount : null,
      detail: profitReady
        ? `Model a small ${assumptions.pilotProfitPct}% skim during the virtual pilot, then grow toward the target.`
        : "Wait until operating buckets stop showing red pressure.",
    },
    {
      key: "owner-pay",
      label: "Owner Pay",
      mode: "virtual",
      amount: null,
      detail: "Keep visible, but pilot after tax and profit prove stable.",
    },
    {
      key: "operating",
      label: "COGS, Labor, OpEx",
      mode: "virtual",
      amount: null,
      detail: "Use these as guardrails before enforcing real draw-down accounts.",
    },
    {
      key: "investor-return",
      label: "Investor Return",
      mode: investorAmount > 0 ? "virtual" : "not_ready",
      amount: investorAmount > 0 ? investorAmount : null,
      detail:
        investorAmount > 0
          ? "Modeled virtually only until repayment priority and agreement terms are defined."
          : "Set an investor return assumption once repayment priority and terms are defined.",
    },
  ];
}

function normalizeAssumptions(input?: Partial<GoLiveAssumptions>): GoLiveAssumptions {
  const floor = input?.operatingCashFloor;
  const pilotProfitPct = input?.pilotProfitPct ?? DEFAULT_PILOT_PROFIT_PCT;
  const investorReturnPct = input?.investorReturnPct ?? DEFAULT_INVESTOR_RETURN_PCT;
  return {
    operatingCashFloor: typeof floor === "number" && Number.isFinite(floor) && floor >= 0 ? r2(floor) : null,
    operatingCashFloorSource: typeof floor === "number" && Number.isFinite(floor) && floor >= 0 ? "manual" : "auto",
    pilotProfitPct: r2(Math.min(Math.max(pilotProfitPct, 0), 20)),
    investorReturnPct: r2(Math.min(Math.max(investorReturnPct, 0), 20)),
  };
}

function assessCashSafety(currentCash: number | null | undefined, minimumOperatingCash: number | null | undefined, pilotSetAside: number): CashSafety {
  if (currentCash == null || minimumOperatingCash == null) {
    return {
      hasAnchor: false,
      currentCash: currentCash ?? null,
      minimumOperatingCash: minimumOperatingCash ?? null,
      pilotSetAside: r2(pilotSetAside),
      cushionAfterPilot: null,
      ready: false,
      detail: "Set one starting cash balance/date so Go-Live Coach can judge whether a pilot leaves enough operating cash.",
    };
  }

  const cushionAfterPilot = currentCash - minimumOperatingCash - pilotSetAside;
  return {
    hasAnchor: true,
    currentCash: r2(currentCash),
    minimumOperatingCash: r2(minimumOperatingCash),
    pilotSetAside: r2(pilotSetAside),
    cushionAfterPilot: r2(cushionAfterPilot),
    ready: cushionAfterPilot >= 0,
    detail:
      cushionAfterPilot >= 0
        ? "Estimated cash can cover the operating floor after the virtual pilot set-aside."
        : "The pilot would dip below the operating cash floor; stay virtual or reduce the pilot.",
  };
}

function buildDecisions(stage: GoLiveStage, cashSafety: CashSafety, redBuckets: GoLiveBucket[], taxReady: boolean): DecisionLine[] {
  return [
    {
      key: "move-money",
      label: "Pilot virtually now?",
      verdict: stage === "pilot_ready" && cashSafety.ready ? "go" : "wait",
      detail:
        stage === "pilot_ready" && cashSafety.ready
          ? "Start the pilot as a model only, beginning with Tax Reserve and a small Profit skim."
          : "Stay virtual until data, bucket pressure, and cash floor all clear.",
    },
    {
      key: "fix-first",
      label: "Fix first",
      verdict: redBuckets.length > 0 || !taxReady ? "watch" : "go",
      detail:
        redBuckets.length > 0
          ? `${redBuckets[0].label} is the first constraint to correct.`
          : taxReady
            ? "No blocking bucket pressure is showing."
            : "Collected tax is the first source to wire before a tax pilot.",
    },
    {
      key: "investor-return",
      label: "Investor return",
      verdict: "watch",
      detail: "Keep investor return virtual until repayment terms define priority, amount, and waterfall rules.",
    },
  ];
}

export function assessGoLiveReadiness(input: GoLiveCoachInput): GoLiveCoachData {
  const assumptions = normalizeAssumptions(input.assumptions);
  const targets = calculateTargets(input.netSales, input.taps);
  const spend = (tap: string): number => Math.max(0, input.spendByTap[tap] ?? 0);

  const taxSourced = input.salesTaxCollected > 0;
  const taxGap = input.salesTaxCollected - input.salesTaxCleared;
  const taxSignal: HealthStatus = !taxSourced ? "yellow" : taxGap >= 0 ? "green" : "red";
  const taxBucket: GoLiveBucket = {
    key: "tax-reserve",
    label: "Tax Reserve",
    kind: "reserve",
    target: r2(input.salesTaxCollected),
    actual: r2(input.salesTaxCleared),
    gap: r2(taxGap),
    usagePct: taxSourced && input.salesTaxCollected > 0 ? r2((input.salesTaxCleared / input.salesTaxCollected) * 100) : null,
    signal: taxSignal,
    ready: taxSourced && taxSignal !== "red",
    note: taxSourced
      ? "Collected tax is visible; keep the reserve ahead of actual pulls."
      : "Collected sales tax is not synced yet, so tax can only stay virtual.",
  };

  const buckets: GoLiveBucket[] = [
    taxBucket,
    accrueBucket("profit", "Profit", targets.profit, "Profit is protected first in pilot; start small if cash is tight."),
    accrueBucket("owner-pay", "Owner Pay", targets.ownerPay, "Owner pay is visible now, but not a first pilot bucket unless cash is stable."),
    drawdownBucket("food", "Food COGS", targets.cogsFood, spend("COGS_FOOD"), "Food spend should stay inside its sales-funded lane."),
    drawdownBucket(
      "alcohol-beverage",
      "Alcohol / Beverage COGS",
      targets.cogsLiquor,
      spend("COGS_LIQUOR") + spend("COGS_BEVERAGE"),
      "Liquor, wine, beer, and beverage distributors share the alcohol/beverage allocation.",
    ),
    drawdownBucket("labor", "Labor", targets.labor, spend("LABOR"), "Labor pressure is the clearest sign that owner pay or profit will be starved."),
    drawdownBucket("opex", "OpEx", targets.opex, spend("OPEX"), "OpEx needs room after food, labor, tax, and protected profit."),
  ];

  const categorizationCoveragePct =
    input.transactionCount > 0 ? (input.categorizedTransactionCount / input.transactionCount) * 100 : 0;
  const coverageReady = input.transactionCount > 0 && categorizationCoveragePct >= 80;
  const historyReady = input.salesDays >= 14;
  const fullHistoryReady = input.salesDays >= 30;
  const bankReady = input.transactionCount > 0;
  const redBuckets = buckets.filter((b) => b.signal === "red");
  const shortfalls = buckets.filter((b) => b.gap < 0);
  const allBucketsReady = redBuckets.length === 0 && taxBucket.ready;

  const checks: GoLiveCheck[] = [
    {
      key: "sales-history",
      label: "Sales history",
      ready: historyReady,
      detail: `${input.salesDays} day${input.salesDays === 1 ? "" : "s"} of POS sales in this period`,
    },
    {
      key: "bank-activity",
      label: "Bank feed",
      ready: bankReady,
      detail: bankReady ? `${input.transactionCount} outflow transaction${input.transactionCount === 1 ? "" : "s"} reviewed` : "No bank outflows in this period yet",
    },
    {
      key: "categorization",
      label: "Category coverage",
      ready: coverageReady,
      detail: `${r2(categorizationCoveragePct)}% of outflow transactions have a category`,
    },
    {
      key: "tax-source",
      label: "Sales tax source",
      ready: taxBucket.ready,
      detail: taxSourced ? "Collected sales tax is synced from POS; DAVO pulls draw the reserve down." : "Sync collected sales tax before piloting Tax Reserve",
    },
    {
      key: "bucket-pressure",
      label: "Bucket pressure",
      ready: redBuckets.length === 0,
      detail:
        redBuckets.length === 0
          ? "No bucket is over its virtual capacity"
          : `${redBuckets.map((b) => b.label).join(", ")} need attention`,
    },
  ];

  let stage: GoLiveStage;
  if (input.netSales <= 0 && input.transactionCount === 0) stage = "observe";
  else if (!historyReady || !bankReady) stage = "simulate";
  else if (!coverageReady || redBuckets.length > 0 || !taxBucket.ready) stage = "coach";
  else if (fullHistoryReady && categorizationCoveragePct >= 95 && allBucketsReady) stage = "enforce_ready";
  else stage = "pilot_ready";

  let recommendation: string;
  if (stage === "observe") {
    recommendation = "Connect POS and bank data, then let the app observe the heartbeat before changing cash behavior.";
  } else if (stage === "simulate") {
    recommendation = "Keep Profit First virtual while more history builds; use this period to name dollars and confirm targets.";
  } else if (!taxBucket.ready) {
    recommendation = "Stay virtual until collected sales tax is synced and the Tax Reserve can be trusted.";
  } else if (redBuckets.length > 0) {
    recommendation = `Stay virtual and fix ${redBuckets[0].label}; it would break first if money moved today.`;
  } else if (stage === "pilot_ready") {
    recommendation = "Ready to model a 30-day pilot: protect Tax Reserve and skim Profit virtually before any real transfer setup.";
  } else {
    recommendation = "Ready to design the second onboarding: account setup, transfer approvals, and automation guardrails.";
  }

  const topShortfall = shortfalls[0];
  const summary =
    stage === "coach" && topShortfall
      ? `${topShortfall.label} is short by ${Math.abs(topShortfall.gap).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}; this is where the virtual model would have broken.`
      : stage === "pilot_ready"
        ? "The virtual model is stable enough to rehearse a narrow pilot, starting with tax and a small profit skim."
        : stage === "enforce_ready"
          ? "The heartbeat is stable enough to plan real account routing, but money movement still needs a second onboarding."
        : "The app is still building trust in the data before it recommends account setup.";
  const pilotPlan = buildPilotPlan(stage, buckets, assumptions, input.netSales);
  const pilotSetAside = pilotPlan
    .filter((p) => p.mode === "pilot_candidate")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const cashSafety = assessCashSafety(input.currentCash, input.minimumOperatingCash, pilotSetAside);
  checks.push({
    key: "cash-floor",
    label: "Cash anchor",
    ready: cashSafety.ready,
    detail: cashSafety.detail,
  });
  const decisions = buildDecisions(stage, cashSafety, redBuckets, taxBucket.ready);

  return {
    periodLabel: input.periodLabel,
    hasData: input.netSales > 0 || input.transactionCount > 0,
    stage,
    stageLabel: stageLabel(stage),
    stageNote: stageNote(stage),
    recommendation,
    summary,
    netSales: r2(input.netSales),
    salesDays: input.salesDays,
    transactionCount: input.transactionCount,
    categorizationCoveragePct: r2(categorizationCoveragePct),
    buckets,
    shortfalls,
    checks,
    pilotPlan,
    cashSafety,
    decisions,
    assumptions,
  };
}

function settingsNumber(settings: unknown, key: string): number | null {
  if (!settings || typeof settings !== "object") return null;
  const value = (settings as Record<string, unknown>)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export async function loadGoLiveCoach(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<GoLiveCoachData> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    include: { tapSettings: true },
  });
  const taps: Taps = restaurant?.tapSettings
    ? {
        profitPct: n(restaurant.tapSettings.profitPct),
        ownerPayPct: n(restaurant.tapSettings.ownerPayPct),
        cogsFoodPct: n(restaurant.tapSettings.cogsFoodPct),
        cogsLiquorPct: n(restaurant.tapSettings.cogsLiquorPct),
        laborPct: n(restaurant.tapSettings.laborPct),
        opexPct: n(restaurant.tapSettings.opexPct),
      }
    : DEFAULT_TAPS;

  const latest = await db.dailySales.findFirst({
    where: { restaurantId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const ref = latest?.date ?? new Date();
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  const periodLabel = `${MONTHS[ref.getUTCMonth()]} ${ref.getUTCFullYear()} MTD`;

  const sales = await db.dailySales.findMany({
    where: { restaurantId, date: { gte: start, lt: end } },
    select: { netSales: true, salesTaxCollected: true },
  });
  const netSales = sales.reduce((sum, s) => sum + Math.max(0, n(s.netSales)), 0);
  const salesTaxCollected = sales.reduce((sum, s) => sum + n(s.salesTaxCollected), 0);

  const cats = await db.category.findMany({
    where: { restaurantId },
    select: { id: true, tapBucket: true },
  });
  const tapByCat = new Map(cats.map((c) => [c.id, c.tapBucket as string]));

  const txns = await db.transaction.findMany({
    where: { restaurantId, date: { gte: start, lt: end }, amount: { gt: 0 } },
    select: { amount: true, categoryId: true },
  });
  const periodOutflow = txns.reduce((sum, t) => sum + n(t.amount), 0);

  const spendByTap: Record<string, number> = {};
  let categorizedTransactionCount = 0;
  let salesTaxCleared = 0;
  for (const t of txns) {
    const tap = (t.categoryId && tapByCat.get(t.categoryId)) || "OPEX";
    if (t.categoryId) categorizedTransactionCount += 1;
    if (tap === "REVENUE" || tap === "EXCLUDED") continue;
    if (tap === "TAX_SALES") {
      salesTaxCleared += n(t.amount);
      continue;
    }
    spendByTap[tap] = (spendByTap[tap] ?? 0) + n(t.amount);
  }

  let currentCash: number | null = null;
  if (restaurant?.cashBalanceAnchor && restaurant.cashBalanceAnchorDate) {
    const sinceAnchor = await db.transaction.findMany({
      where: { restaurantId, date: { gt: restaurant.cashBalanceAnchorDate } },
      select: { amount: true },
    });
    currentCash = n(restaurant.cashBalanceAnchor) + sinceAnchor.reduce((sum, t) => sum + -n(t.amount), 0);
  }

  const avgDailyOutflow = sales.length > 0 ? periodOutflow / Math.max(sales.length, 1) : 0;
  const cfg = await db.moduleConfig.findUnique({
    where: { restaurantId_moduleKey: { restaurantId, moduleKey: GO_LIVE_MODULE_KEY } },
    select: { settings: true },
  });
  const manualFloor = settingsNumber(cfg?.settings, "operatingCashFloor");
  const pilotProfitPct = settingsNumber(cfg?.settings, "pilotProfitPct");
  const investorReturnPct = settingsNumber(cfg?.settings, "investorReturnPct");
  const minimumOperatingCash = manualFloor ?? Math.max(5000, avgDailyOutflow * 7);

  return assessGoLiveReadiness({
    periodLabel,
    salesDays: sales.length,
    netSales,
    transactionCount: txns.length,
    categorizedTransactionCount,
    salesTaxCollected,
    salesTaxCleared,
    taps,
    spendByTap,
    currentCash,
    minimumOperatingCash,
    assumptions: {
      operatingCashFloor: manualFloor,
      pilotProfitPct: pilotProfitPct ?? DEFAULT_PILOT_PROFIT_PCT,
      investorReturnPct: investorReturnPct ?? DEFAULT_INVESTOR_RETURN_PCT,
    },
  });
}
