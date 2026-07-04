import type { BusinessType } from "@prisma/client";

const TYPE_ALIASES: Record<string, BusinessType> = {
  restaurant: "RESTAURANT",
  hospitality: "RESTAURANT",
  service: "SERVICE",
  contractor: "CONTRACTOR",
  "field-service": "CONTRACTOR",
  brokerage: "REAL_ESTATE_BROKERAGE",
  "real-estate": "REAL_ESTATE_BROKERAGE",
  "real-estate-brokerage": "REAL_ESTATE_BROKERAGE",
  rental: "VACATION_RENTAL",
  rentals: "VACATION_RENTAL",
  "vacation-rental": "VACATION_RENTAL",
  "property-management": "VACATION_RENTAL",
  retail: "RETAIL",
};

export function businessTypeFromOnboardingParam(value: string | string[] | null | undefined): BusinessType {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  return TYPE_ALIASES[normalized] ?? "RESTAURANT";
}
