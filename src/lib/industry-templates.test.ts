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
      expect(template.defaultModuleKeys.length).toBeGreaterThan(0);
      expect(sourceMap.minimumAutoInput).toBeTruthy();
      expect(sourceMap.groups.length).toBeGreaterThan(0);

      for (const key of template.defaultModuleKeys) {
        expect(moduleKeys.has(key), `${type} references missing module "${key}"`).toBe(true);
      }
    }
  });
});
