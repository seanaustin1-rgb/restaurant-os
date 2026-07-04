import { describe, expect, it } from "vitest";
import { SOURCE_MAPS } from "./source-map";
import { SOURCE_PROFILES, sourceProfile, type SourceProfileId } from "./source-profiles";

const PILOT_PROFILE_IDS: SourceProfileId[] = [
  "boldtrail-crm",
  "boldtrail-backoffice",
  "appfiles-transactions",
  "escapia-operations",
  "escapia-owner-statements",
];

describe("source profiles", () => {
  it("defines the brokerage and vacation-rental pilot sources", () => {
    for (const id of PILOT_PROFILE_IDS) {
      const profile = sourceProfile(id);
      expect(profile?.id).toBe(id);
      expect(profile?.connectionLabel).toBeTruthy();
      expect(profile?.apiReality).toBeTruthy();
      expect(profile?.csvFallback).toBeTruthy();
      expect(profile?.importedEntities.length).toBeGreaterThan(0);
      expect(profile?.requiredIdentity.length).toBeGreaterThan(0);
      expect(profile?.dashboardUnlocks.length).toBeGreaterThan(0);
      expect(profile?.riskNotes.length).toBeGreaterThan(0);
    }
  });

  it("keeps every profile attached to an actual source-map option", () => {
    const attached = new Set<string>();
    for (const sourceMap of Object.values(SOURCE_MAPS)) {
      for (const group of sourceMap.groups) {
        for (const option of group.options) {
          if (option.profileId) attached.add(option.profileId);
        }
      }
    }

    expect([...attached].sort()).toEqual(Object.keys(SOURCE_PROFILES).sort());
  });

  it("matches profile category to the source-map group category", () => {
    for (const sourceMap of Object.values(SOURCE_MAPS)) {
      for (const group of sourceMap.groups) {
        for (const option of group.options) {
          const profile = sourceProfile(option.profileId);
          if (!profile) continue;
          expect(profile.category, `${option.name} profile category`).toBe(group.category);
        }
      }
    }
  });
});
