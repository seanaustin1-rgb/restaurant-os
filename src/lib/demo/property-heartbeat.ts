import type { Health } from "./estimate";

export interface PropertyHeartbeatInput {
  name: string;
  monthlyBookingRevenue: number;
  occupancyPct: number;
  averageDailyRate: number;
  cleaningCosts: number;
  maintenanceCosts: number;
  platformFees: number;
  managementFeePct: number;
  ownerReserveTarget: number;
  openIssues: number;
  repeatIssues: number;
  avgResponseHours: number;
  reviewRating: number;
  futureBookedNights: number;
  next30AvailableNights: number;
}

export interface PropertyHeartbeatResult {
  name: string;
  monthlyBookingRevenue: number;
  occupancyPct: number;
  averageDailyRate: number;
  revPar: number;
  cleaningCosts: number;
  maintenanceCosts: number;
  platformFees: number;
  managementFee: number;
  ownerProceeds: number;
  ownerProceedsPct: number;
  ownerProceedsHealth: Health;
  ownerReserveTarget: number;
  reserveCushion: number;
  openIssues: number;
  repeatIssues: number;
  maintenancePressurePct: number;
  maintenanceHealth: Health;
  guestAuraScore: number;
  guestAuraHealth: Health;
  bookingPacePct: number;
  bookingMomentumHealth: Health;
  overallHealth: Health;
  note: string;
}

const rank: Record<Health, number> = { green: 0, yellow: 1, red: 2 };

function nonNegative(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function bandLower(value: number, green: number, yellow: number): Health {
  if (value <= green) return "green";
  if (value <= yellow) return "yellow";
  return "red";
}

function bandHigher(value: number, green: number, yellow: number): Health {
  if (value >= green) return "green";
  if (value >= yellow) return "yellow";
  return "red";
}

function worst(...values: Health[]): Health {
  return values.reduce<Health>((current, next) => (rank[next] > rank[current] ? next : current), "green");
}

function noteFor(result: Omit<PropertyHeartbeatResult, "note">): string {
  if (result.maintenanceHealth === "red") return "Maintenance drag is high; owner proceeds and guest experience may be at risk.";
  if (result.guestAuraHealth === "red") return "Guest Aura is weak; reviews, response time, or repeat issues need attention.";
  if (result.bookingMomentumHealth === "red") return "Forward bookings are light against the next 30 available nights.";
  if (result.ownerProceedsHealth === "red") return "Owner proceeds are thin after operating costs and management fees.";
  return "Property is producing usable owner proceeds with manageable operating pressure.";
}

export function computePropertyHeartbeat(input: PropertyHeartbeatInput): PropertyHeartbeatResult {
  const monthlyBookingRevenue = nonNegative(input.monthlyBookingRevenue);
  const occupancyPct = clamp(input.occupancyPct, 0, 100);
  const averageDailyRate = nonNegative(input.averageDailyRate);
  const cleaningCosts = nonNegative(input.cleaningCosts);
  const maintenanceCosts = nonNegative(input.maintenanceCosts);
  const platformFees = nonNegative(input.platformFees);
  const managementFeePct = clamp(input.managementFeePct, 0, 100);
  const ownerReserveTarget = nonNegative(input.ownerReserveTarget);
  const openIssues = nonNegative(input.openIssues);
  const repeatIssues = nonNegative(input.repeatIssues);
  const avgResponseHours = nonNegative(input.avgResponseHours);
  const reviewRating = clamp(input.reviewRating, 0, 5);
  const futureBookedNights = nonNegative(input.futureBookedNights);
  const next30AvailableNights = nonNegative(input.next30AvailableNights);

  const managementFee = (monthlyBookingRevenue * managementFeePct) / 100;
  const ownerProceeds = monthlyBookingRevenue - cleaningCosts - maintenanceCosts - platformFees - managementFee;
  const ownerProceedsPct = monthlyBookingRevenue > 0 ? (ownerProceeds / monthlyBookingRevenue) * 100 : 0;
  const revPar = averageDailyRate * (occupancyPct / 100);
  const reserveCushion = ownerProceeds - ownerReserveTarget;
  const maintenancePressurePct = monthlyBookingRevenue > 0 ? ((maintenanceCosts + cleaningCosts) / monthlyBookingRevenue) * 100 : 0;
  const bookingPacePct = next30AvailableNights > 0 ? (futureBookedNights / next30AvailableNights) * 100 : 100;

  const ratingScore = (reviewRating / 5) * 55;
  const responseScore = Math.max(0, 20 - avgResponseHours);
  const issuePenalty = Math.min(35, openIssues * 4 + repeatIssues * 8);
  const guestAuraScore = clamp(ratingScore + responseScore + 25 - issuePenalty, 0, 100);

  const ownerProceedsHealth = bandHigher(ownerProceedsPct, 45, 30);
  const maintenanceHealth = bandLower(maintenancePressurePct, 20, 28);
  const guestAuraHealth = bandHigher(guestAuraScore, 75, 55);
  const bookingMomentumHealth = bandHigher(bookingPacePct, 55, 35);
  const overallHealth = worst(ownerProceedsHealth, maintenanceHealth, guestAuraHealth, bookingMomentumHealth);

  const withoutNote = {
    name: input.name.trim() || "Property",
    monthlyBookingRevenue,
    occupancyPct,
    averageDailyRate,
    revPar,
    cleaningCosts,
    maintenanceCosts,
    platformFees,
    managementFee,
    ownerProceeds,
    ownerProceedsPct,
    ownerProceedsHealth,
    ownerReserveTarget,
    reserveCushion,
    openIssues,
    repeatIssues,
    maintenancePressurePct,
    maintenanceHealth,
    guestAuraScore,
    guestAuraHealth,
    bookingPacePct,
    bookingMomentumHealth,
    overallHealth,
  };

  return { ...withoutNote, note: noteFor(withoutNote) };
}
