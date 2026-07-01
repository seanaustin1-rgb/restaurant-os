import type { BusinessType, PrismaClient } from "@prisma/client";
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

type StepText = {
  cashAnchorLabel: string;
  cashAnchorTodo: string;
  cashAnchorDone: string;
  mappingLabel: string;
  mappingTodo: string;
  mappingDone: string;
  mappingHref: string;
  liveSourceTodo: string;
};

const DEFAULT_TEXT: StepText = {
  cashAnchorLabel: "Set cash anchor",
  cashAnchorTodo: "Enter a known cash balance and date so runway can be judged.",
  cashAnchorDone: "Cash anchor is set for runway and go-live safety.",
  mappingLabel: "Review vendor mappings",
  mappingTodo: "Confirm where recurring vendors belong so the dashboard can trust costs.",
  mappingDone: "Vendor/category rules exist for future cleanup.",
  mappingHref: "/onboarding/vendors",
  liveSourceTodo: "Owner/operator authorizes bank, POS, Google, accounting, or booking sources.",
};

const TEXT_BY_TYPE: Partial<Record<BusinessType, Partial<StepText>>> = {
  RESTAURANT: {
    mappingLabel: "Review vendor and food-cost mappings",
    mappingTodo: "Map recurring vendors, food, beverage, payroll, tax, and OpEx so prime cost can be trusted.",
    mappingDone: "Vendor/category rules exist for restaurant spend cleanup.",
    liveSourceTodo: "Owner/operator authorizes bank, POS, Google, payroll, or food-cost sources.",
  },
  SERVICE: {
    mappingLabel: "Review client and vendor mappings",
    mappingTodo: "Map recurring vendors, payroll, software, contractors, and client-payment activity.",
    mappingDone: "Rules exist for service-business spend cleanup.",
    liveSourceTodo: "Owner/operator authorizes bank, accounting, CRM, payment, or reputation sources.",
  },
  CONTRACTOR: {
    cashAnchorLabel: "Set cash and job-float anchor",
    cashAnchorTodo: "Enter known cash so runway can be judged against materials, payroll, deposits, and receivables.",
    cashAnchorDone: "Cash anchor is set for job-float and runway checks.",
    mappingLabel: "Review job-cost mappings",
    mappingTodo: "Map materials, subcontractors, equipment, payroll, fuel, insurance, and OpEx.",
    mappingDone: "Rules exist for contractor spend and job-cost cleanup.",
    liveSourceTodo: "Owner/operator authorizes bank, accounting, job-management, payroll, or reputation sources.",
  },
  REAL_ESTATE_BROKERAGE: {
    cashAnchorLabel: "Set operating cash anchor",
    cashAnchorTodo: "Enter known cash so runway can be judged between closings and commission cycles.",
    cashAnchorDone: "Operating cash anchor is set for brokerage runway checks.",
    mappingLabel: "Review commission and lead-cost mappings",
    mappingTodo: "Map agent payouts, referral fees, franchise fees, lead spend, staff payroll, and OpEx.",
    mappingDone: "Rules exist for brokerage spend and commission cleanup.",
    mappingHref: "/import/brokerage",
    liveSourceTodo: "Owner/operator authorizes bank, accounting, CRM, transaction, listing, or reputation sources.",
  },
  VACATION_RENTAL: {
    cashAnchorLabel: "Set owner-payout cash anchor",
    cashAnchorTodo: "Enter known cash so runway can be judged against owner payouts, turns, repairs, and lodging-tax timing.",
    cashAnchorDone: "Cash anchor is set for property-services runway checks.",
    mappingLabel: "Import and map properties",
    mappingTodo: "Import properties, bookings, owner statements, maintenance, reviews, or property-level costs.",
    mappingDone: "Property or category data exists for vacation-rental cleanup.",
    mappingHref: "/import/rentals",
    liveSourceTodo: "Owner/operator authorizes bank, booking platform, PMS, accounting, maintenance, or review sources.",
  },
  RETAIL: {
    cashAnchorLabel: "Set cash and inventory anchor",
    cashAnchorTodo: "Enter known cash so runway can be judged against inventory buys, payroll, and tax timing.",
    cashAnchorDone: "Cash anchor is set for cash and inventory pressure checks.",
    mappingLabel: "Review inventory and vendor mappings",
    mappingTodo: "Map inventory purchases, merchant fees, payroll, rent, returns, supplies, and OpEx.",
    mappingDone: "Rules exist for retail spend and inventory cleanup.",
    liveSourceTodo: "Owner/operator authorizes bank, POS, ecommerce, inventory, accounting, or review sources.",
  },
};

function copyFor(type: BusinessType): StepText {
  return { ...DEFAULT_TEXT, ...(TEXT_BY_TYPE[type] ?? {}) };
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
          brokerageAgents: true,
          brokerageDeals: true,
          brokerageLeadSpend: true,
        },
      },
    },
  });
  if (!restaurant) return null;

  const copy = copyFor(restaurant.businessType);
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
  const hasBrokerageImport =
    restaurant.businessType === "REAL_ESTATE_BROKERAGE" &&
    (restaurant._count.brokerageAgents > 0 || restaurant._count.brokerageDeals > 0 || restaurant._count.brokerageLeadSpend > 0);
  const hasVendorRules = vendorRuleCount > 0 || hasBrokerageImport;
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
        : copy.liveSourceTodo,
      "/settings/sources?intro=1",
    ),
    step(
      statusFromDone(hasCashAnchor),
      "cash-anchor",
      copy.cashAnchorLabel,
      hasCashAnchor ? copy.cashAnchorDone : copy.cashAnchorTodo,
      "/modules/cash-runway",
    ),
    step(
      statusFromDone(hasVendorRules),
      "vendor-mapping",
      copy.mappingLabel,
      hasVendorRules ? copy.mappingDone : copy.mappingTodo,
      copy.mappingHref,
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
