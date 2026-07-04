import { describe, expect, it } from "vitest";
import { SOURCE_MAPS } from "./source-map";
import {
  SOURCE_PROFILES,
  buildSourceSelectedNote,
  buildSourceSetupNote,
  isSourceProfileId,
  sourceApiSetupLabel,
  sourceApiSetupState,
  sourceProfile,
  sourceSetupChecklist,
  type SourceProfileId,
} from "./source-profiles";

const PILOT_PROFILE_IDS: SourceProfileId[] = [
  "boldtrail-crm",
  "follow-up-boss-crm",
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
      expect(profile?.credentialIntake.length).toBeGreaterThan(0);
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
    const profile = sourceProfile("follow-up-boss-crm");
    expect(profile).toBeTruthy();
    const note = buildSourceSetupNote(profile!);
    const checklist = sourceSetupChecklist(profile!);

    expect(note).toContain("API setup requested");
    expect(note).toContain("Fallback:");
    expect(note.toLowerCase()).not.toContain("password");
    expect(note.toLowerCase()).not.toContain("paste");
    expect(checklist).toEqual(expect.arrayContaining([expect.stringContaining("API:"), expect.stringContaining("CSV fallback:")]));
    expect(checklist).toEqual(expect.arrayContaining([expect.stringContaining("Intake: Follow Up Boss API key via secure_support (secret)")]));
  });

  it("builds an onboarding selected note without marking API setup requested", () => {
    const profile = sourceProfile("boldtrail-crm");
    expect(profile).toBeTruthy();
    const note = buildSourceSelectedNote(profile!);

    expect(note).toContain("selected during onboarding");
    expect(note).toContain("Fallback:");
    expect(note).not.toContain("API setup requested");
    expect(sourceApiSetupState({ profile: profile!, status: "PLANNED", notes: note })).toBe("api_available");
  });

  it("routes secret credential intake through secure support", () => {
    for (const profile of Object.values(SOURCE_PROFILES)) {
      for (const item of profile.credentialIntake) {
        if (item.sensitivity === "secret") {
          expect(item.collectVia, `${profile.id} ${item.key}`).toBe("secure_support");
          expect(item.detail.toLowerCase()).toMatch(/secure|encrypted/);
        }
      }
    }
  });

  it("validates profile ids from API input", () => {
    expect(isSourceProfileId("escapia-operations")).toBe(true);
    expect(isSourceProfileId("not-a-profile")).toBe(false);
    expect(isSourceProfileId(null)).toBe(false);
  });

  it("derives setup status from source status and setup notes", () => {
    const apiProfile = sourceProfile("escapia-operations")!;
    const csvProfile = sourceProfile("appfiles-transactions")!;

    expect(sourceApiSetupState({ profile: apiProfile, status: "PLANNED", notes: null })).toBe("api_available");
    expect(sourceApiSetupState({ profile: csvProfile, status: "PLANNED", notes: null })).toBe("csv_ready");
    expect(sourceApiSetupState({ profile: apiProfile, status: "PLANNED", notes: buildSourceSetupNote(apiProfile) })).toBe("api_requested");
    expect(sourceApiSetupState({ profile: csvProfile, status: "PLANNED", notes: buildSourceSetupNote(csvProfile) })).toBe("import_requested");
    expect(sourceApiSetupState({ profile: apiProfile, status: "CONNECTED", notes: null })).toBe("connected");
    expect(sourceApiSetupState({ profile: apiProfile, status: "BLOCKED", notes: null })).toBe("blocked");
    expect(sourceApiSetupState({ profile: apiProfile, status: "NOT_NEEDED", notes: null })).toBe("not_needed");
    expect(sourceApiSetupLabel("api_requested").label).toBe("API requested");
    expect(sourceApiSetupLabel("import_requested").label).toBe("Import planned");
  });
});
