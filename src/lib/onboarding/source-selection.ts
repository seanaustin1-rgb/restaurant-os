import type { BusinessType } from "@prisma/client";
import { sourceMapFor, type SourceCategory, type SourceOption } from "@/lib/source-map";
import { buildSourceSelectedNote, sourceProfile } from "@/lib/source-profiles";

export interface OnboardingSourceSelection {
  category: SourceCategory;
  providerName: string;
}

export interface PlannedOnboardingSourceConfig extends OnboardingSourceSelection {
  status: "PLANNED";
  notes: string | null;
  updatedBy?: string;
}

export function onboardingSourceKey(category: SourceCategory, providerName: string): string {
  return `${category}::${providerName}`;
}

export function defaultOnboardingSourceSelections(businessType: BusinessType): OnboardingSourceSelection[] {
  return sourceMapFor(businessType).groups.flatMap((group) =>
    group.options
      .filter((option) => option.minimum)
      .map((option) => ({ category: group.category, providerName: option.name })),
  );
}

function selectedNote(option: SourceOption): string | null {
  const profile = sourceProfile(option.profileId);
  if (profile) return buildSourceSelectedNote(profile);
  return `${option.name}: selected during onboarding.`;
}

export function plannedSourceConfigsForOnboarding(input: {
  businessType: BusinessType;
  selectedSources?: OnboardingSourceSelection[];
  updatedBy?: string;
}): PlannedOnboardingSourceConfig[] {
  const sourceMap = sourceMapFor(input.businessType);
  const selected = input.selectedSources ?? defaultOnboardingSourceSelections(input.businessType);
  const selectedKeys = new Set(selected.map((source) => onboardingSourceKey(source.category, source.providerName)));
  const planned: PlannedOnboardingSourceConfig[] = [];
  const seen = new Set<string>();

  for (const group of sourceMap.groups) {
    for (const option of group.options) {
      const key = onboardingSourceKey(group.category, option.name);
      if (!selectedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      planned.push({
        category: group.category,
        providerName: option.name,
        status: "PLANNED",
        notes: selectedNote(option),
        ...(input.updatedBy ? { updatedBy: input.updatedBy } : {}),
      });
    }
  }

  return planned;
}
