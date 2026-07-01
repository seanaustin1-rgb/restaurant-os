import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, Landmark, PlugZap, ShieldCheck, Unplug } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { industryTemplateFor } from "@/lib/industry-templates";
import { sourceMapFor } from "@/lib/source-map";
import { loadSourceConfigSnapshots } from "@/lib/source-status";
import {
  financialSyncHealthStatus,
  loadFinancialSyncHealth,
  type FinancialSyncHealth,
} from "@/lib/financial-ledger/sync-health";
import { SourceMapPlanner } from "@/components/sources/SourceMapPlanner";
import { GoogleBusinessProfileLocationPicker } from "@/components/sources/GoogleBusinessProfileLocationPicker";
import {
  GOOGLE_BUSINESS_PROFILE_PROVIDER,
  type GoogleBusinessProfileLocation,
} from "@/lib/integrations/google-business-profile/oauth";
import { DisconnectGoogleBusinessProfileButton } from "@/components/sources/DisconnectGoogleBusinessProfileButton";

const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

function keyOf(category: string, providerName: string): string {
  return `${category}::${providerName}`;
}

function googleLocationsFromMetadata(metadata: unknown): GoogleBusinessProfileLocation[] {
  if (!metadata || typeof metadata !== "object" || !("locations" in metadata)) return [];
  const locations = (metadata as { locations?: unknown }).locations;
  if (!Array.isArray(locations)) return [];
  return locations.filter((location): location is GoogleBusinessProfileLocation => {
    if (!location || typeof location !== "object") return false;
    const value = location as Partial<GoogleBusinessProfileLocation>;
    return typeof value.accountId === "string" && typeof value.locationId === "string" && typeof value.title === "string";
  });
}

function FinancialDataSafetyPanel({ health }: { health: FinancialSyncHealth }) {
  const status = financialSyncHealthStatus(health);
  const toneClass =
    status.tone === "green"
      ? "border-health-green/40 bg-health-green/5 text-health-green"
      : status.tone === "red"
      ? "border-health-red/40 bg-health-red/5 text-health-red"
      : status.tone === "yellow"
      ? "border-health-yellow/40 bg-health-yellow/5 text-health-yellow"
      : "border-line bg-ink/30 text-muted";
  const StatusIcon = status.tone === "green" ? CheckCircle2 : status.tone === "muted" ? Database : AlertTriangle;

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Database size={18} className="mt-0.5 text-copper-soft" />
          <div>
            <h2 className="text-sm font-medium text-ink-text">Financial data safety</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
              Imported records are quarantined first, then mapped into reviewed financial events before they can feed the
              clean ledger used by Cash Oxygen, Tax Vault, Go-Live Coach, and investor reads.
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${toneClass}`}>
          <StatusIcon size={13} /> {status.label}
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">{status.detail}</p>

      <div className="mt-3">
        <Link
          href="/settings/sources/review"
          className="inline-flex items-center justify-center rounded-md border border-copper-dim px-3 py-2 text-xs text-copper-soft hover:border-copper"
        >
          Review mappings
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Raw imports</p>
          <p className="mt-1 text-lg text-ink-text">{health.rawEventCount.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Pending review</p>
          <p className="mt-1 text-lg text-ink-text">{health.pendingMappingCount.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Ledger entries</p>
          <p className="mt-1 text-lg text-ink-text">{health.ledgerEntryCount.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Open issues</p>
          <p className="mt-1 text-lg text-ink-text">{health.unresolvedExceptionCount.toLocaleString()}</p>
        </div>
      </div>

      {health.recentIssues.length > 0 && (
        <div className="mt-3 space-y-2">
          {health.recentIssues.map((issue) => (
            <div key={issue.id} className="rounded-md border border-health-yellow/30 bg-health-yellow/5 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-health-yellow">{issue.severity}</span>
                <span className="text-muted">{issue.sourceSystem}</span>
                <span className="text-muted">{issue.issueType}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-text">{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function SourceMapPage({
  searchParams,
}: {
  searchParams?: { google?: string; reason?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { role: true, restaurantId: true, restaurant: { select: { name: true, businessType: true } } },
  });

  if (!role) redirect("/dashboard");

  const template = industryTemplateFor(role.restaurant.businessType);
  const sourceMap = sourceMapFor(role.restaurant.businessType);
  const configs = await loadSourceConfigSnapshots(role.restaurantId, prisma);
  const syncHealth = await loadFinancialSyncHealth(role.restaurantId, prisma);
  const statusByKey = new Map(configs.map((config) => [keyOf(config.category, config.providerName), config.status]));
  const configByKey = new Map(configs.map((config) => [keyOf(config.category, config.providerName), config]));
  const sourceConnectedBank = configByKey.get(keyOf("cash", "Plaid"))?.status === "CONNECTED";
  const sourceConnectedGoogle = configByKey.get(keyOf("aura", "Google Business Profile"))?.status === "CONNECTED";
  const ownerApprovalSources = sourceMap.groups.flatMap((group) =>
    group.options
      .filter((option) => {
        const name = option.name.toLowerCase();
        return (
          name === "plaid" ||
          name.includes("google business profile") ||
          name.includes("square") ||
          name.includes("clover") ||
          name.includes("shopify") ||
          name.includes("quickbooks") ||
          name.includes("xero")
        );
      })
      .filter((option) => statusByKey.get(keyOf(group.category, option.name)) !== "CONNECTED")
      .map((option) => option.name),
  );
  const pendingGoogleConnection = await prisma.integrationConnection.findFirst({
    where: {
      restaurantId: role.restaurantId,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      externalLocationId: { in: ["pending", "unselected"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, metadata: true },
  });
  const googleLocationChoices = googleLocationsFromMetadata(pendingGoogleConnection?.metadata);
  const activeGoogleConnection = await prisma.integrationConnection.findFirst({
    where: {
      restaurantId: role.restaurantId,
      provider: GOOGLE_BUSINESS_PROFILE_PROVIDER,
      isActive: true,
      externalLocationId: { notIn: ["pending", "unselected"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, displayName: true, updatedAt: true },
  });
  const bankConnectionCount = await prisma.plaidConnection.count({
    where: { restaurantId: role.restaurantId, isActive: true },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Setup</p>
          <h1 className="mt-1 font-display text-2xl text-copper-soft">Source Onboarding</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {role.restaurant.name} is using the {template.label.toLowerCase()} template. Pick the systems the business
            uses. OutFront will guide the owner through secure connections where available and keep support-assisted
            setup clearly labeled.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-copper-dim px-3 py-1 text-xs text-copper-soft">
            {role.role.toLowerCase()} view
          </span>
          <Link href="/onboarding" className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-text hover:border-copper-dim">
            Back to setup steps
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-copper-dim/40 bg-surface p-4">
        <div className="flex items-start gap-2">
          <PlugZap size={18} className="mt-0.5 text-copper-soft" />
          <div>
            <h2 className="text-sm font-medium text-ink-text">Minimum useful path</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{sourceMap.minimumAutoInput}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck size={18} className="mt-0.5 text-health-green" />
          <div>
            <h2 className="text-sm font-medium text-ink-text">Customer promise</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The owner should only need to choose the systems they use, approve secure connections, and confirm the
              business or location when prompted. Anything more technical belongs in a support-assisted setup path.
            </p>
          </div>
        </div>
      </section>

      <FinancialDataSafetyPanel health={syncHealth} />

      <section className="rounded-lg border border-line bg-surface p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted">Device guidance</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          A phone is fine for planning and owner approval notes. A computer is recommended for bank/POS authorization,
          file uploads, location confirmation, and bulk cleanup.
        </p>
      </section>

      {ownerApprovalSources.length > 0 && (
        <section className="rounded-lg border border-copper-dim/40 bg-copper/5 p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck size={18} className="mt-0.5 text-copper-soft" />
            <div>
              <h2 className="text-sm font-medium text-ink-text">
                {role.role === "OPERATOR" ? "Owner approvals to finish" : "Owner approval handoff"}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {role.role === "OPERATOR"
                  ? "These sources should be authorized by the owner/operator when you are ready:"
                  : "Plan these sources here, then ask the owner/operator to authorize them:"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ownerApprovalSources.slice(0, 6).map((name) => (
                  <span key={name} className="rounded-full border border-copper-dim px-2 py-1 text-[11px] text-copper-soft">
                    {name}
                  </span>
                ))}
                {ownerApprovalSources.length > 6 && (
                  <span className="rounded-full border border-line px-2 py-1 text-[11px] text-muted">
                    +{ownerApprovalSources.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-text">
              <Unplug size={16} /> Live authorizations
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Owner-approved connections can be turned off here. Advisors can plan setup and leave notes, but sensitive
              bank and Google authorization should stay visible to the operator.
            </p>
          </div>
          <span className="rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-muted">
            {role.role === "OPERATOR" ? "owner controls" : "advisor view"}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-ink/40 px-3 py-3">
            <div className="flex items-start gap-2">
              <Landmark size={16} className="mt-0.5 text-copper-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-text">Bank authorization</p>
                <p className="mt-0.5 text-xs text-muted">
                  {bankConnectionCount > 0
                    ? `${bankConnectionCount} active bank connection${bankConnectionCount === 1 ? "" : "s"}.`
                    : sourceConnectedBank
                    ? "Demo/import bank feed is connected. No live bank authorization is stored."
                    : "No active bank authorization yet."}
                </p>
                {bankConnectionCount === 0 && sourceConnectedBank ? (
                  <p className="mt-2 text-xs text-muted">Use live bank authorization only when replacing the demo feed with a real client account.</p>
                ) : role.role === "OPERATOR" ? (
                  <Link href="/connections" className="mt-2 inline-flex text-xs text-copper-soft hover:text-copper">
                    Manage bank connections
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-muted">An owner/operator should manage bank authorization.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-line bg-ink/40 px-3 py-3">
            <div className="flex items-start gap-2">
              <PlugZap size={16} className="mt-0.5 text-copper-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-text">Google Business Profile</p>
                <p className="mt-0.5 text-xs text-muted">
                  {activeGoogleConnection
                    ? `${activeGoogleConnection.displayName ?? "Google Business Profile"} is authorized.`
                    : sourceConnectedGoogle
                    ? "Demo/import Aura feed is connected. No live Google authorization is stored."
                    : "No active Google authorization yet."}
                </p>
                {!activeGoogleConnection && sourceConnectedGoogle ? (
                  <p className="mt-2 text-xs text-muted">Use Google authorization only when replacing the demo feed with a real client location.</p>
                ) : activeGoogleConnection && role.role === "OPERATOR" ? (
                  <div className="mt-2">
                    <DisconnectGoogleBusinessProfileButton
                      connectionId={activeGoogleConnection.id}
                      label={activeGoogleConnection.displayName ?? "this business"}
                    />
                  </div>
                ) : activeGoogleConnection ? (
                  <p className="mt-2 text-xs text-muted">An owner/operator can disconnect this authorization.</p>
                ) : role.role === "OPERATOR" ? (
                  <Link
                    href="/api/google-business-profile/oauth/start"
                    className="mt-2 inline-flex text-xs text-copper-soft hover:text-copper"
                  >
                    Authorize Google
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-muted">An owner/operator should authorize this Google connection.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {searchParams?.google && (
        <section
          className={
            "rounded-lg border px-4 py-3 text-sm " +
            (searchParams.google === "connected"
              ? "border-health-green/40 bg-health-green/5 text-health-green"
              : "border-health-yellow/40 bg-health-yellow/5 text-health-yellow")
          }
        >
          {searchParams.google === "connected"
            ? "Google Business Profile is authorized. We found a location and saved it for Aura."
            : searchParams.google === "choose_location"
              ? "Google authorization worked. Choose the correct Business Profile location below."
              : searchParams.google === "needs_location"
              ? "Google authorized successfully, but no Business Profile location was found. Support should confirm the account."
              : `Google authorization needs attention${searchParams.reason ? `: ${searchParams.reason}` : "."}`}
        </section>
      )}

      {pendingGoogleConnection && googleLocationChoices.length > 1 && role.role === "OPERATOR" && (
        <GoogleBusinessProfileLocationPicker connectionId={pendingGoogleConnection.id} locations={googleLocationChoices} />
      )}

      {pendingGoogleConnection && googleLocationChoices.length > 1 && role.role !== "OPERATOR" && (
        <section className="rounded-lg border border-health-yellow/40 bg-health-yellow/5 px-4 py-3 text-sm text-health-yellow">
          Google is authorized, but the owner/operator needs to choose which Business Profile location should feed Aura.
        </section>
      )}

      <SourceMapPlanner sourceMap={sourceMap} initialConfigs={configs} actorRole={role.role} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <h2 className="text-sm font-medium text-ink-text">Finished planning sources?</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Return to the setup steps when the source plan looks right. You can come back and adjust it later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/onboarding" className="rounded-md border border-line px-3 py-2 text-sm text-ink-text hover:border-copper-dim">
            Back to setup steps
          </Link>
          <Link href="/dashboard" className="rounded-md border border-copper-dim px-3 py-2 text-sm text-copper-soft hover:border-copper">
            View dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
