import type { Health } from "./estimate";

export type VacationRentalCapability =
  | "propertyManagers"
  | "unitInventory"
  | "rates"
  | "feesTaxes"
  | "bookingRestrictions"
  | "bookingChannels"
  | "bookings"
  | "ownerStatements"
  | "propertyExpenses"
  | "maintenance"
  | "housekeeping"
  | "reviews";

export interface VacationRentalSourceInput {
  name: string;
  capabilities: VacationRentalCapability[];
}

export interface VacationRentalImportReadinessInput {
  unitCount: number;
  annualBookings: number;
  sources: VacationRentalSourceInput[];
}

export interface ImportLayerResult {
  key: "escapiaReadiness" | "profitability" | "operationsAura";
  label: string;
  coveragePct: number;
  health: Health;
  present: VacationRentalCapability[];
  missing: VacationRentalCapability[];
  note: string;
}

export interface VacationRentalImportReadinessResult {
  unitCount: number;
  annualBookings: number;
  connectedSources: string[];
  overallCoveragePct: number;
  overallHealth: Health;
  layers: ImportLayerResult[];
  nextBestSource: string;
}

const CAPABILITY_LABEL: Record<VacationRentalCapability, string> = {
  propertyManagers: "property managers",
  unitInventory: "unit inventory",
  rates: "rates",
  feesTaxes: "fees/taxes",
  bookingRestrictions: "booking restrictions",
  bookingChannels: "booking channels",
  bookings: "bookings",
  ownerStatements: "owner statements",
  propertyExpenses: "property expenses",
  maintenance: "maintenance",
  housekeeping: "housekeeping",
  reviews: "reviews",
};

const LAYERS: Omit<ImportLayerResult, "coveragePct" | "health" | "present" | "missing" | "note">[] = [
  { key: "escapiaReadiness", label: "Operational readiness" },
  { key: "profitability", label: "Property profitability" },
  { key: "operationsAura", label: "Operations + guest Aura" },
];

const REQUIRED: Record<ImportLayerResult["key"], VacationRentalCapability[]> = {
  escapiaReadiness: ["propertyManagers", "unitInventory", "rates", "feesTaxes", "bookingRestrictions", "bookingChannels"],
  profitability: ["bookings", "ownerStatements", "propertyExpenses"],
  operationsAura: ["maintenance", "housekeeping", "reviews"],
};

function healthForCoverage(coverage: number): Health {
  if (coverage >= 80) return "green";
  if (coverage >= 45) return "yellow";
  return "red";
}

function labelList(keys: VacationRentalCapability[]): string {
  return keys.map((key) => CAPABILITY_LABEL[key]).join(", ");
}

function noteFor(key: ImportLayerResult["key"], missing: VacationRentalCapability[]): string {
  if (missing.length === 0) return "Enough source coverage to start this layer.";
  if (key === "escapiaReadiness") return `Escapia-like PMS data still needs ${labelList(missing)}.`;
  if (key === "profitability") return `Profitability needs ${labelList(missing)} from statements, accounting, or exports.`;
  return `Guest/operations Aura needs ${labelList(missing)} from maintenance, housekeeping, or review sources.`;
}

function nextSource(layers: ImportLayerResult[]): string {
  const profitability = layers.find((layer) => layer.key === "profitability");
  if (profitability?.missing.includes("bookings")) return "reservation export or PMS bookings feed";
  if (profitability?.missing.includes("ownerStatements")) return "owner statement export";
  if (profitability?.missing.includes("propertyExpenses")) return "QuickBooks classes/locations or property expense export";
  const operations = layers.find((layer) => layer.key === "operationsAura");
  if (operations?.missing.includes("maintenance")) return "maintenance/work-order report";
  if (operations?.missing.includes("reviews")) return "review/guest feedback feed";
  return "rate freshness and booking-restriction sync";
}

export function computeVacationRentalImportReadiness(
  input: VacationRentalImportReadinessInput,
): VacationRentalImportReadinessResult {
  const capabilities = new Set<VacationRentalCapability>();
  for (const source of input.sources) {
    for (const capability of source.capabilities) capabilities.add(capability);
  }

  const layers: ImportLayerResult[] = LAYERS.map((layer) => {
    const required = REQUIRED[layer.key];
    const present = required.filter((capability) => capabilities.has(capability));
    const missing = required.filter((capability) => !capabilities.has(capability));
    const coveragePct = required.length > 0 ? (present.length / required.length) * 100 : 100;
    return {
      ...layer,
      coveragePct,
      health: healthForCoverage(coveragePct),
      present,
      missing,
      note: noteFor(layer.key, missing),
    };
  });

  const overallCoveragePct = layers.reduce((sum, layer) => sum + layer.coveragePct, 0) / layers.length;

  return {
    unitCount: Math.max(0, input.unitCount),
    annualBookings: Math.max(0, input.annualBookings),
    connectedSources: input.sources.map((source) => source.name),
    overallCoveragePct,
    overallHealth: healthForCoverage(overallCoveragePct),
    layers,
    nextBestSource: nextSource(layers),
  };
}
