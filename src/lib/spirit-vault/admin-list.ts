export const ADMIN_STATUS_FILTERS = ["all", "live", "hidden", "draft", "reviewed", "published"] as const;
export const ADMIN_VOICE_FILTERS = ["all", "missing", "present"] as const;
export const ADMIN_VERIFICATION_FILTERS = ["all", "unsourced", "partially-sourced", "sourced"] as const;

export type AdminStatusFilter = (typeof ADMIN_STATUS_FILTERS)[number];
export type AdminVoiceFilter = (typeof ADMIN_VOICE_FILTERS)[number];
export type AdminVerificationFilter = (typeof ADMIN_VERIFICATION_FILTERS)[number];

export interface SpiritAdminListFilters {
  q: string;
  status: AdminStatusFilter;
  voice: AdminVoiceFilter;
  verification: AdminVerificationFilter;
  category: string;
}

export interface SpiritAdminListItem {
  id: string;
  name: string;
  brand: string;
  expression: string | null;
  category: string;
  recordStatus: string;
  publicationStatus: string;
  verificationStatus: string;
  hasVoice: boolean;
}

export interface SpiritAdminListSummary {
  total: number;
  live: number;
  hidden: number;
  drafts: number;
  reviewed: number;
  missingVoice: number;
  unsourced: number;
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function oneOf<T extends readonly string[]>(value: string, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value) ? (value as T[number]) : fallback;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function parseSpiritAdminListFilters(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): SpiritAdminListFilters {
  const q = firstParam(searchParams?.q).trim();
  const status = oneOf(firstParam(searchParams?.status), ADMIN_STATUS_FILTERS, "all");
  const voice = oneOf(firstParam(searchParams?.voice), ADMIN_VOICE_FILTERS, "all");
  const verification = oneOf(firstParam(searchParams?.verification), ADMIN_VERIFICATION_FILTERS, "all");
  const category = firstParam(searchParams?.category).trim();

  return { q, status, voice, verification, category };
}

export function isLiveSpirit(item: Pick<SpiritAdminListItem, "recordStatus" | "publicationStatus">): boolean {
  return item.recordStatus === "PUBLISHED" && item.publicationStatus === "PUBLISHED";
}

export function summarizeSpiritAdminList(items: SpiritAdminListItem[]): SpiritAdminListSummary {
  return {
    total: items.length,
    live: items.filter(isLiveSpirit).length,
    hidden: items.filter((item) => !isLiveSpirit(item)).length,
    drafts: items.filter((item) => item.recordStatus === "DRAFT" || item.publicationStatus === "DRAFT").length,
    reviewed: items.filter((item) => item.recordStatus === "REVIEWED" || item.publicationStatus === "REVIEWED").length,
    missingVoice: items.filter((item) => !item.hasVoice).length,
    unsourced: items.filter((item) => item.verificationStatus === "UNSOURCED").length,
  };
}

export function filterSpiritAdminList(
  items: SpiritAdminListItem[],
  filters: SpiritAdminListFilters,
): SpiritAdminListItem[] {
  const query = normalized(filters.q);
  const category = normalized(filters.category);

  return items.filter((item) => {
    if (filters.status === "live" && !isLiveSpirit(item)) return false;
    if (filters.status === "hidden" && isLiveSpirit(item)) return false;
    if (filters.status === "draft" && item.recordStatus !== "DRAFT" && item.publicationStatus !== "DRAFT") {
      return false;
    }
    if (filters.status === "reviewed" && item.recordStatus !== "REVIEWED" && item.publicationStatus !== "REVIEWED") {
      return false;
    }
    if (
      filters.status === "published" &&
      item.recordStatus !== "PUBLISHED" &&
      item.publicationStatus !== "PUBLISHED"
    ) {
      return false;
    }
    if (filters.voice === "missing" && item.hasVoice) return false;
    if (filters.voice === "present" && !item.hasVoice) return false;
    if (filters.verification === "unsourced" && item.verificationStatus !== "UNSOURCED") return false;
    if (filters.verification === "partially-sourced" && item.verificationStatus !== "PARTIALLY_SOURCED") {
      return false;
    }
    if (filters.verification === "sourced" && item.verificationStatus !== "SOURCED") return false;
    if (category && normalized(item.category) !== category) return false;
    if (!query) return true;

    return [item.name, item.brand, item.expression ?? "", item.category].some((value) =>
      normalized(value).includes(query),
    );
  });
}

export function spiritAdminCategoryOptions(items: SpiritAdminListItem[]): string[] {
  return [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
