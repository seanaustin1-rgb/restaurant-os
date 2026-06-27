import type { DataSourceStatus, PrismaClient } from "@prisma/client";

export interface SourceConfigSnapshot {
  category: string;
  providerName: string;
  status: DataSourceStatus;
  notes: string | null;
}

function keyOf(config: Pick<SourceConfigSnapshot, "category" | "providerName">) {
  return `${config.category}::${config.providerName}`;
}

function mergeSourceConfigs(
  saved: SourceConfigSnapshot[],
  actual: SourceConfigSnapshot[],
): SourceConfigSnapshot[] {
  const byKey = new Map(saved.map((config) => [keyOf(config), config]));
  for (const config of actual) {
    const existing = byKey.get(keyOf(config));
    byKey.set(keyOf(config), {
      ...existing,
      ...config,
      notes: existing?.notes ?? config.notes,
    });
  }
  return [...byKey.values()];
}

export async function loadSourceConfigSnapshots(
  restaurantId: string,
  db: PrismaClient,
): Promise<SourceConfigSnapshot[]> {
  let saved: SourceConfigSnapshot[] = [];

  try {
    saved = await db.dataSourceConfig.findMany({
      where: { restaurantId },
      select: { category: true, providerName: true, status: true, notes: true },
    });
  } catch {
    saved = [];
  }

  const actual: SourceConfigSnapshot[] = [];

  const activePlaid = await db.plaidConnection.findFirst({
    where: { restaurantId, isActive: true },
    select: { id: true },
  });
  if (activePlaid) {
    actual.push({
      category: "cash",
      providerName: "Plaid",
      status: "CONNECTED",
      notes: "Detected from active bank connection.",
    });
  }

  const posConnections = await db.posConnection.findMany({
    where: { restaurantId, isActive: true },
    select: { provider: true },
  });
  const posProviders = new Set(posConnections.map((connection) => connection.provider));
  const hasToastSales = await db.dailySales.findFirst({
    where: { restaurantId, source: "toast" },
    select: { id: true },
  });

  if (posProviders.has("TOAST") || hasToastSales) {
    actual.push({
      category: "sales",
      providerName: "Toast",
      status: "CONNECTED",
      notes: "Detected from live Toast sync.",
    });
  }
  if (posProviders.has("SQUARE")) {
    actual.push({
      category: "sales",
      providerName: "Square",
      status: "CONNECTED",
      notes: "Detected from active POS connection.",
    });
  }
  if (posProviders.has("CLOVER")) {
    actual.push({
      category: "sales",
      providerName: "Clover",
      status: "CONNECTED",
      notes: "Detected from active POS connection.",
    });
  }

  const googleBusinessProfile = await db.integrationConnection.findFirst({
    where: { restaurantId, provider: "GOOGLE_BUSINESS_PROFILE", isActive: true },
    select: { displayName: true, externalLocationId: true },
  });
  if (googleBusinessProfile) {
    actual.push({
      category: "aura",
      providerName: "Google Business Profile",
      status: googleBusinessProfile.externalLocationId === "unselected" ? "BLOCKED" : "CONNECTED",
      notes: googleBusinessProfile.displayName
        ? `Detected Google Business Profile connection: ${googleBusinessProfile.displayName}.`
        : "Detected Google Business Profile connection.",
    });
  }

  return mergeSourceConfigs(saved, actual);
}
