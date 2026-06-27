import { describe, expect, it } from "vitest";
import type { BusinessType } from "@prisma/client";
import { INDUSTRY_TEMPLATES } from "./industry-templates";
import { MODULES } from "./modules";
import { SOURCE_MAPS } from "./source-map";

const BUSINESS_TYPES: BusinessType[] = [
  "RESTAURANT",
  "SERVICE",
  "RETAIL",
  "CONTRACTOR",
  "REAL_ESTATE_BROKERAGE",
  "VACATION_RENTAL",
];

describe("industry templates", () => {
  it("covers every business type with source maps and real module keys", () => {
    const moduleKeys = new Set(MODULES.map((m) => m.key));

    for (const type of BUSINESS_TYPES) {
      const template = INDUSTRY_TEMPLATES[type];
      const sourceMap = SOURCE_MAPS[type];

      expect(template.label).toBeTruthy();
      expect(template.scaleAnchor.label).toBeTruthy();
      expect(template.defaultModuleKeys.length).toBeGreaterThan(0);
      expect(template.seedAccounts.length).toBeGreaterThan(0);
      expect(sourceMap.minimumAutoInput).toBeTruthy();
      expect(sourceMap.groups.length).toBeGreaterThan(0);

      for (const key of template.defaultModuleKeys) {
        expect(moduleKeys.has(key), `${type} references missing module "${key}"`).toBe(true);
      }
    }
  });

  it("seeds every sector with allocation accounts that sum to 100", () => {
    for (const type of BUSINESS_TYPES) {
      const total = INDUSTRY_TEMPLATES[type].seedAccounts.reduce((sum, account) => sum + account.targetPct, 0);
      expect(total, `${type} seed accounts must sum to 100`).toBe(100);
    }
  });

  it("keeps profile question keys unique per sector", () => {
    for (const type of BUSINESS_TYPES) {
      const keys = INDUSTRY_TEMPLATES[type].profileQuestions.map((question) => question.key);
      expect(new Set(keys).size, `${type} has duplicate profile question keys`).toBe(keys.length);
    }
  });

  it("surfaces the real estate paid add-on lanes in the brokerage template", () => {
    expect(INDUSTRY_TEMPLATES.REAL_ESTATE_BROKERAGE.defaultModuleKeys).toEqual(
      expect.arrayContaining([
        "company-dollar",
        "commission-pipeline",
        "agent-performance",
        "market-intelligence",
        "lead-roi",
      ]),
    );
  });

  it("surfaces the property heartbeat lane in the vacation rental template", () => {
    expect(INDUSTRY_TEMPLATES.VACATION_RENTAL.defaultModuleKeys).toEqual(
      expect.arrayContaining(["property-heartbeat", "occupancy", "property-profit"]),
    );
  });
});
