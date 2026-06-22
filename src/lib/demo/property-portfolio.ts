import type { Health } from "./estimate";
import {
  computePropertyHeartbeat,
  type PropertyHeartbeatInput,
  type PropertyHeartbeatResult,
} from "./property-heartbeat";

export interface PropertyPortfolioResult {
  propertyCount: number;
  healthyCount: number;
  watchCount: number;
  pressureCount: number;
  monthlyBookingRevenue: number;
  ownerProceeds: number;
  ownerProceedsPct: number;
  maintenanceCosts: number;
  maintenancePressurePct: number;
  averageGuestAuraScore: number;
  averageOccupancyPct: number;
  overallHealth: Health;
  topPressure: PropertyHeartbeatResult | null;
  properties: PropertyHeartbeatResult[];
  note: string;
}

const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };

function healthForRatio(value: number, green: number, yellow: number, higherIsBetter = true): Health {
  if (higherIsBetter) {
    if (value >= green) return "green";
    if (value >= yellow) return "yellow";
    return "red";
  }
  if (value <= green) return "green";
  if (value <= yellow) return "yellow";
  return "red";
}

function weightedAverage(sum: number, denominator: number): number {
  return denominator > 0 ? sum / denominator : 0;
}

function noteFor(result: Omit<PropertyPortfolioResult, "note">): string {
  if (result.pressureCount > result.propertyCount * 0.25) {
    return "Too many properties are under pressure; sort by maintenance drag and owner proceeds first.";
  }
  if (result.maintenancePressurePct > 28) {
    return "Maintenance and cleaning are absorbing too much of the portfolio revenue.";
  }
  if (result.averageGuestAuraScore < 55) {
    return "Guest Aura is soft across the portfolio; reviews, response times, and repeat issues need attention.";
  }
  if (result.ownerProceedsPct < 30) {
    return "Owner proceeds are thin after operating costs and management fees.";
  }
  return "Portfolio is producing usable owner proceeds with manageable property-level pressure.";
}

export function computePropertyPortfolio(inputs: PropertyHeartbeatInput[]): PropertyPortfolioResult {
  const properties = inputs.map(computePropertyHeartbeat);
  const propertyCount = properties.length;
  const monthlyBookingRevenue = properties.reduce((sum, property) => sum + property.monthlyBookingRevenue, 0);
  const ownerProceeds = properties.reduce((sum, property) => sum + property.ownerProceeds, 0);
  const maintenanceCosts = properties.reduce((sum, property) => sum + property.maintenanceCosts + property.cleaningCosts, 0);
  const averageGuestAuraScore = weightedAverage(
    properties.reduce((sum, property) => sum + property.guestAuraScore, 0),
    propertyCount,
  );
  const averageOccupancyPct = weightedAverage(
    properties.reduce((sum, property) => sum + property.occupancyPct, 0),
    propertyCount,
  );
  const ownerProceedsPct = monthlyBookingRevenue > 0 ? (ownerProceeds / monthlyBookingRevenue) * 100 : 0;
  const maintenancePressurePct = monthlyBookingRevenue > 0 ? (maintenanceCosts / monthlyBookingRevenue) * 100 : 0;
  const healthyCount = properties.filter((property) => property.overallHealth === "green").length;
  const watchCount = properties.filter((property) => property.overallHealth === "yellow").length;
  const pressureCount = properties.filter((property) => property.overallHealth === "red").length;

  const pressureMixHealth: Health =
    pressureCount > propertyCount * 0.25 ? "red" : pressureCount > 0 ? "yellow" : "green";
  const rollupHealth = [
    healthForRatio(ownerProceedsPct, 45, 30),
    healthForRatio(maintenancePressurePct, 20, 28, false),
    healthForRatio(averageGuestAuraScore, 75, 55),
    pressureMixHealth,
  ].reduce<Health>((current, next) => (rank[next] > rank[current] ? next : current), "green");

  const topPressure =
    properties
      .slice()
      .sort((a, b) => rank[b.overallHealth] - rank[a.overallHealth] || a.ownerProceeds - b.ownerProceeds)[0] ?? null;

  const withoutNote = {
    propertyCount,
    healthyCount,
    watchCount,
    pressureCount,
    monthlyBookingRevenue,
    ownerProceeds,
    ownerProceedsPct,
    maintenanceCosts,
    maintenancePressurePct,
    averageGuestAuraScore,
    averageOccupancyPct,
    overallHealth: rollupHealth,
    topPressure,
    properties,
  };

  return { ...withoutNote, note: noteFor(withoutNote) };
}
