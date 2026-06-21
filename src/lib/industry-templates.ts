import type { BusinessType } from "@prisma/client";

export type HeartbeatLensKey = "cash" | "discipline" | "pressure" | "momentum" | "aura";

export interface IndustryTemplate {
  key: BusinessType;
  label: string;
  description: string;
  primarySetup: string;
  lenses: HeartbeatLensKey[];
  defaultModuleKeys: string[];
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
  },
};

export function industryTemplateFor(type: BusinessType | null | undefined): IndustryTemplate {
  return INDUSTRY_TEMPLATES[type ?? "RESTAURANT"] ?? INDUSTRY_TEMPLATES.RESTAURANT;
}
