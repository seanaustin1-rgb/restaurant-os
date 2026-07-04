import { describe, expect, it } from "vitest";
import { SOURCE_MAPS } from "./source-map";
import {
  SOURCE_PROFILES,
  buildSourceSetupNote,
  isSourceProfileId,
  sourceProfile,
  sourceSetupChecklist,
  type SourceProfileId,
} from "./source-profiles";

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
      expect(profile?.apiAccessNeeds.length).toBeGreaterThan(0);
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

  it("builds an API setup note and checklist without asking for raw credentials", () => {
    const profile = sourceProfile("boldtrail-crm");
    expect(profile).toBeTruthy();
    const note = buildSourceSetupNote(profile!);
    const checklist = sourceSetupChecklist(profile!);

    expect(note).toContain("API setup requested");
    expect(note).toContain("Fallback:");
    expect(note.toLowerCase()).not.toContain("password");
    expect(checklist).toEqual(expect.arrayContaining([expect.stringContaining("API:"), expect.stringContaining("CSV fallback:")]));
  });

  it("validates profile ids from API input", () => {
    expect(isSourceProfileId("escapia-operations")).toBe(true);
    expect(isSourceProfileId("not-a-profile")).toBe(false);
    expect(isSourceProfileId(null)).toBe(false);
  });
});
