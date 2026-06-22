import type { Health } from "./estimate";

export interface MarketAuraInput {
  market: string;
  newListings7d: number;
  pendings7d: number;
  avgDom: number;
  domTrendPct: number;
  priceDrops7d: number;
  showingAppointments7d: number;
  showingTrendPct: number;
  mortgageRatePct: number;
  mortgageRateChangeBps7d: number;
  googleIntentTrendPct: number;
}

export interface MarketAuraResult {
  market: string;
  listingToPendingRatio: number;
  contractVelocityScore: number;
  domPressureScore: number;
  priceDropPressureScore: number;
  showingDemandScore: number;
  ratePressureScore: number;
  digitalIntentScore: number;
  marketAuraScore: number;
  marketAuraHealth: Health;
  note: string;
}

function nonNegative(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function bandHigher(value: number, green: number, yellow: number): Health {
  if (value >= green) return "green";
  if (value >= yellow) return "yellow";
  return "red";
}

function scoreHigher(value: number, green: number, red: number): number {
  if (green === red) return 50;
  return clamp(((value - red) / (green - red)) * 100, 0, 100);
}

function scoreLower(value: number, green: number, red: number): number {
  if (green === red) return 50;
  return clamp(((red - value) / (red - green)) * 100, 0, 100);
}

function noteFor(result: Omit<MarketAuraResult, "note">): string {
  if (result.ratePressureScore < 35) return "Mortgage-rate pressure is weighing on buyer demand.";
  if (result.domPressureScore < 35) return "Days on market are stretching; listing velocity may slow.";
  if (result.priceDropPressureScore < 35) return "Price reductions are rising, a sign sellers may be losing leverage.";
  if (result.showingDemandScore < 35) return "Showing demand is soft, so near-term pipeline may need extra scrutiny.";
  if (result.marketAuraHealth === "green") return "Market energy supports the next 45-90 days of pipeline.";
  return "Market energy is mixed; watch pipeline assumptions before spending against future closings.";
}

export function computeMarketAura(input: MarketAuraInput): MarketAuraResult {
  const newListings7d = nonNegative(input.newListings7d);
  const pendings7d = nonNegative(input.pendings7d);
  const avgDom = nonNegative(input.avgDom);
  const domTrendPct = input.domTrendPct;
  const priceDrops7d = nonNegative(input.priceDrops7d);
  const showingAppointments7d = nonNegative(input.showingAppointments7d);
  const showingTrendPct = input.showingTrendPct;
  const mortgageRatePct = nonNegative(input.mortgageRatePct);
  const mortgageRateChangeBps7d = input.mortgageRateChangeBps7d;
  const googleIntentTrendPct = input.googleIntentTrendPct;

  const listingToPendingRatio = newListings7d > 0 ? pendings7d / newListings7d : pendings7d > 0 ? 2 : 0;
  const priceDropRate = newListings7d > 0 ? priceDrops7d / newListings7d : priceDrops7d > 0 ? 1 : 0;

  const contractVelocityScore = scoreHigher(listingToPendingRatio, 0.9, 0.35);
  const domLevelScore = scoreLower(avgDom, 28, 75);
  const domTrendScore = scoreLower(domTrendPct, 0, 25);
  const domPressureScore = (domLevelScore * 0.65) + (domTrendScore * 0.35);
  const priceDropPressureScore = scoreLower(priceDropRate, 0.12, 0.45);
  const showingLevelScore = scoreHigher(showingAppointments7d, 120, 25);
  const showingTrendScore = scoreHigher(showingTrendPct, 8, -18);
  const showingDemandScore = (showingLevelScore * 0.55) + (showingTrendScore * 0.45);
  const rateLevelScore = scoreLower(mortgageRatePct, 6.25, 7.75);
  const rateTrendScore = scoreLower(mortgageRateChangeBps7d, 0, 40);
  const ratePressureScore = (rateLevelScore * 0.55) + (rateTrendScore * 0.45);
  const digitalIntentScore = scoreHigher(googleIntentTrendPct, 12, -18);

  const marketAuraScore =
    contractVelocityScore * 0.24 +
    domPressureScore * 0.18 +
    priceDropPressureScore * 0.14 +
    showingDemandScore * 0.2 +
    ratePressureScore * 0.16 +
    digitalIntentScore * 0.08;

  const withoutNote = {
    market: input.market.trim() || "Local market",
    listingToPendingRatio,
    contractVelocityScore,
    domPressureScore,
    priceDropPressureScore,
    showingDemandScore,
    ratePressureScore,
    digitalIntentScore,
    marketAuraScore: clamp(marketAuraScore, 0, 100),
    marketAuraHealth: bandHigher(marketAuraScore, 70, 50),
  };

  return { ...withoutNote, note: noteFor(withoutNote) };
}
