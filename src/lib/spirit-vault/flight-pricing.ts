import { Prisma } from "@prisma/client";

export const FLIGHT_POUR_SIZE_OZ = 1;
export const FLIGHT_PRICING_FORMULA_VERSION = "component_1oz_sum_v1";

export interface PriceableFlightPour {
  id: string;
  venueSpiritId: string;
  priceUsd: Prisma.Decimal | number | string | null;
  pourSizeOz: Prisma.Decimal | number | string | null;
}

export interface FlightPricingLine {
  venueSpiritId: string;
  spiritPourId: string;
  linePriceUsd: number;
}

export interface FlightPricingResult {
  formulaVersion: string;
  totalPriceUsd: number;
  lines: FlightPricingLine[];
}

function decimalToNumber(v: Prisma.Decimal | number | string | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function centsToUsd(cents: number): number {
  return Math.round(cents) / 100;
}

export function calculateFlightLinePriceCents(pour: PriceableFlightPour): number {
  const priceUsd = decimalToNumber(pour.priceUsd);
  const sourcePourSizeOz = decimalToNumber(pour.pourSizeOz);
  if (priceUsd == null || sourcePourSizeOz == null || sourcePourSizeOz <= 0) {
    throw new Error("Every flight item needs a priced source pour");
  }
  return Math.round((priceUsd / sourcePourSizeOz) * FLIGHT_POUR_SIZE_OZ * 100);
}

export function calculateFlightPricing(pours: PriceableFlightPour[]): FlightPricingResult {
  const lines = pours.map((pour) => ({
    venueSpiritId: pour.venueSpiritId,
    spiritPourId: pour.id,
    linePriceUsd: centsToUsd(calculateFlightLinePriceCents(pour)),
  }));
  const totalPriceUsd = centsToUsd(lines.reduce((sum, line) => sum + Math.round(line.linePriceUsd * 100), 0));
  return {
    formulaVersion: FLIGHT_PRICING_FORMULA_VERSION,
    totalPriceUsd,
    lines,
  };
}
