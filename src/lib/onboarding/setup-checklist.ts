import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sourceMapFor } from "@/lib/source-map";
import { loadSourceConfigSnapshots } from "@/lib/source-status";

export type SetupStepStatus = "done" | "next" | "blocked";

export interface OwnerSetupStep {
  key: string;
  label: string;
  detail: string;
  href: string;
  status: SetupStepStatus;
}

export interface OwnerSetupChecklist {
  restaurantId: string;
  businessName: string;
  completed: number;
  total: number;
  percent: number;
  steps: OwnerSetupStep[];
}

function step(status: SetupStepStatus, key: string, label: string, detail: string, href: string): OwnerSetupStep {
  return { key, label, detail, href, status };
}

function statusFromDone(done: boolean, blocked = false): SetupStepStatus {
  if (done) return "done";
  return blocked ? "blocked" : "next";
}

export async function loadOwnerSetupChecklist(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<OwnerSetupChecklist | null> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      id: true,
      name: true,
      businessType: true,
      cashBalanceAnchor: true,
      cashBalanceAnchorDate: true,
      tapSettings: { select: { id: true } },
      targetSettings: { select: { id: true } },
      _count: {
        select: {
          moduleConfigs: true,
          plaidConnections: true,
          posConnections: true,
          integrationConnections: true,
          userRoles: true,
          accessInvites: true,
        },
      },
    },
  });
  if (!restaurant) return null;

  const sourceMap = sourceMapFor(restaurant.businessType);
  const sourceConfigs = await loadSourceConfigSnapshots(restaurantId, db);
  const statusByKey = new Map(sourceConfigs.map((config) => [`${config.category}::${config.providerName}`, config.status]));
  const minimumSources = sourceMap.groups.flatMap((group) =>
    group.options.filter((option) => option.minimum).map((option) => ({ category: group.category, name: option.name })),
  );
  const requiredConnected = minimumSources.filter(
    (source) => statusByKey.get(`${source.category}::${source.name}`) === "CONNECTED",
  ).length;
  const requiredBlocked = minimumSources.some(
    (source) => statusByKey.get(`${source.category}::${source.name}`) === "BLOCKED",
  );
  const sourceMapStarted = sourceConfigs.length > 0;
  const sourceMinimumDone = minimumSources.length > 0 && requiredConnected >= Math.min(2, minimumSources.length);
  const vendorRuleCount = await db.rule.count({ where: { restaurantId, isSystem: false } });

  const hasAnyLiveAuthorization =
    restaurant._count.plaidConnections > 0 ||
    restaurant._count.posConnections > 0 ||
    restaurant._count.integrationConnections > 0;
  const hasCashAnchor = restaurant.cashBalanceAnchor != null && restaurant.cashBalanceAnchorDate != null;
  const hasVendorRules = vendorRuleCount > 0;
  const hasSharedAccess = restaurant._count.userRoles > 1 || restaurant._count.accessInvites > 0;
  const templateDone =
    restaurant._count.moduleConfigs > 0 && restaurant.tapSettings != null && restaurant.targetSettings != null;

  const steps = [
    step(
      statusFromDone(templateDone),
      "template",
      "Confirm business template",
      templateDone ? "Industry template and starting targets are in place." : "Pick the heartbeat shape and default module set.",
      "/settings/business",
    ),
    step(
      statusFromDone(sourceMapStarted, requiredBlocked),
      "source-map",
      "Set source map",
      sourceMapStarted
        ? `${requiredConnected} of ${minimumSources.length} minimum sources are connected.`
        : "Mark what is connected, planned, blocked, or not needed.",
      "/settings/sources?intro=1",
    ),
    step(
      statusFromDone(sourceMinimumDone || hasAnyLiveAuthorization, requiredBlocked),
      "authorize",
      "Authorize live sources",
      sourceMinimumDone
        ? "Minimum live sources are connected for a useful heartbeat."
        : hasAnyLiveAuthorization
          ? "At least one live source authorization is present."
        : "Owner/operator authorizes bank, POS, Google, accounting, or booking sources.",
      "/settings/sources?intro=1",
    ),
    step(
      statusFromDone(hasCashAnchor),
      "cash-anchor",
      "Set cash anchor",
      hasCashAnchor
        ? "Cash anchor is set for runway and go-live safety."
        : "Enter a known cash balance and date so runway can be judged.",
      "/modules/cash-runway",
    ),
    step(
      statusFromDone(hasVendorRules),
      "vendor-mapping",
      "Review vendor mappings",
      hasVendorRules
        ? "Vendor/category rules exist for future cleanup."
        : "Confirm where recurring vendors belong so the dashboard can trust costs.",
      "/onboarding/vendors",
    ),
    step(
      statusFromDone(hasSharedAccess),
      "invite",
      "Invite helpers",
      hasSharedAccess
        ? "At least one helper role or pending invite exists."
        : "Invite a consultant, accountant, manager, or investor when ready.",
      "/settings/access",
    ),
  ];

  const completed = steps.filter((item) => item.status === "done").length;
  const total = steps.length;

  return {
    restaurantId,
    businessName: restaurant.name,
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    steps,
  };
}
