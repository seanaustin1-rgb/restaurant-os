"use client";

import { useMemo, useState, useTransition } from "react";
import type { DataSourceStatus } from "@prisma/client";
import Link from "next/link";
import { Check, ExternalLink, LifeBuoy, LockKeyhole, PlugZap, Save, SearchCheck, ShieldCheck } from "lucide-react";
import { updateSourceConfig } from "@/app/settings/sources/actions";
import type { BusinessSourceMap, SourceCategory, SourceOption } from "@/lib/source-map";

type SourceConfigSnapshot = {
  category: string;
  providerName: string;
  status: DataSourceStatus;
  notes: string | null;
};

const STATUS_OPTIONS: { value: DataSourceStatus; label: string }[] = [
  { value: "PLANNED", label: "Planned" },
  { value: "CONNECTED", label: "Connected" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "NOT_NEEDED", label: "Not needed" },
];

const STATUS_STYLE: Record<DataSourceStatus, string> = {
  PLANNED: "border-copper-dim text-copper-soft",
  CONNECTED: "border-health-green/50 text-health-green",
  BLOCKED: "border-health-red/50 text-health-red",
  NOT_NEEDED: "border-line text-muted",
};

type ConnectMode = "oauth" | "admin" | "upload" | "planned";
type SetupOwner = "owner" | "advisor" | "support";

interface OnboardingGuide {
  mode: ConnectMode;
  owner: SetupOwner;
  headline: string;
  detail: string;
  primaryLabel: string;
  href?: string;
}

function configKey(category: string, providerName: string) {
  return `${category}::${providerName}`;
}

function errMsg(error: unknown) {
  return error instanceof Error ? error.message : "Could not save source setup.";
}

function providerGuide(category: SourceCategory, option: SourceOption): OnboardingGuide {
  const name = option.name.toLowerCase();
  if (name === "plaid") {
    return {
      mode: "oauth",
      owner: "owner",
      headline: "Customer connects bank",
      detail: "They choose their bank and sign in through the secure bank connection screen. No account numbers are typed into OutFront.",
      primaryLabel: "Connect bank",
      href: "/connections",
    };
  }
  if (name.includes("google business profile")) {
    return {
      mode: "oauth",
      owner: "owner",
      headline: "Customer authorizes Google",
      detail: "They sign in with Google, then confirm the business/location the app discovers.",
      primaryLabel: "Authorize Google",
      href: "/api/google-business-profile/oauth/start",
    };
  }
  if (name === "toast") {
    return {
      mode: "admin",
      owner: "support",
      headline: "Support-assisted POS setup",
      detail: "Support helps confirm the right Toast account and location.",
      primaryLabel: "Request setup help",
    };
  }
  if (name.includes("square") || name.includes("clover") || name.includes("shopify") || name.includes("quickbooks") || name.includes("xero")) {
    return {
      mode: "oauth",
      owner: "owner",
      headline: "Connect with provider login",
      detail: "Use OAuth when enabled, then let the customer confirm the company, store, or location.",
      primaryLabel: "Connect account",
    };
  }
  if (name.includes("statement") || name.includes("csv") || name.includes("mls export")) {
    return {
      mode: "upload",
      owner: "advisor",
      headline: "Upload or forward a file",
      detail: "Use this as the fallback path when a direct integration is not available yet.",
      primaryLabel: category === "cash" ? "Open import" : "Plan upload",
      href: category === "cash" ? "/import" : undefined,
    };
  }
  return {
    mode: "admin",
    owner: "support",
    headline: "Support confirms setup path",
    detail: "Confirm the provider name and account owner. Support will choose the cleanest connection or import path.",
    primaryLabel: "Mark for support",
  };
}

function ownerCopy(owner: SetupOwner): { label: string; detail: string; className: string } {
  if (owner === "owner") {
    return {
      label: "owner-approved",
      detail: "Only the owner/operator should authorize, confirm, or disconnect this source.",
      className: "border-copper-dim text-copper-soft",
    };
  }
  if (owner === "advisor") {
    return {
      label: "advisor-ready",
      detail: "Consultant/accountant can prepare this path and upload or confirm files.",
      className: "border-health-green/40 text-health-green",
    };
  }
  return {
    label: "support-assisted",
    detail: "Support handles provider coordination and setup details.",
    className: "border-line text-muted",
  };
}

function statusCopy(status: DataSourceStatus, guide: OnboardingGuide): { label: string; detail: string } {
  if (status === "CONNECTED") return { label: "Connected", detail: "This source is already connected or represented by an approved demo/import feed." };
  if (status === "BLOCKED") return { label: "Needs help", detail: "Something is blocking setup; support or the account owner needs to resolve it." };
  if (status === "NOT_NEEDED") return { label: "Skip for now", detail: "Not needed for the current onboarding path." };
  if (guide.mode === "oauth") return { label: "Ready to connect", detail: "Customer can start this with a provider login." };
  if (guide.mode === "upload") return { label: "Upload path", detail: "Use a file/import path until a direct connector exists." };
  return { label: "Support setup", detail: "Support should confirm the setup path." };
}

function modeIcon(mode: ConnectMode) {
  if (mode === "oauth") return PlugZap;
  if (mode === "upload") return ExternalLink;
  if (mode === "admin") return LifeBuoy;
  return LockKeyhole;
}

function nextStatus(status: DataSourceStatus, guide: OnboardingGuide): DataSourceStatus {
  if (status === "CONNECTED") return "CONNECTED";
  if (guide.mode === "admin") return "BLOCKED";
  if (guide.mode === "upload") return "PLANNED";
  return "PLANNED";
}

export function SourceMapPlanner({
  sourceMap,
  initialConfigs,
  actorRole,
}: {
  sourceMap: BusinessSourceMap;
  initialConfigs: SourceConfigSnapshot[];
  actorRole: string;
}) {
  const initialByKey = useMemo(() => {
    return new Map(initialConfigs.map((config) => [configKey(config.category, config.providerName), config]));
  }, [initialConfigs]);
  const [drafts, setDrafts] = useState(() => {
    const values: Record<string, { status: DataSourceStatus; notes: string }> = {};
    for (const group of sourceMap.groups) {
      for (const option of group.options) {
        const saved = initialByKey.get(configKey(group.category, option.name));
        values[configKey(group.category, option.name)] = {
          status: saved?.status ?? (option.minimum ? "PLANNED" : "NOT_NEEDED"),
          notes: saved?.notes ?? "",
        };
      }
    }
    return values;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateDraft(key: string, patch: Partial<{ status: DataSourceStatus; notes: string }>) {
    setSavedKey(null);
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function save(category: SourceCategory, providerName: string) {
    const key = configKey(category, providerName);
    const draft = drafts[key];
    if (!draft) return;

    setError(null);
    setSavingKey(key);
    startTransition(async () => {
      try {
        await updateSourceConfig({ category, providerName, status: draft.status, notes: draft.notes });
        setSavedKey(key);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setSavingKey(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-sm text-health-red">
          {error}
        </div>
      )}

      {sourceMap.groups.map((group) => (
        <section key={group.category + group.label} className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink-text">{group.label}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">{group.purpose}</p>
            </div>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
              {group.category}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {group.options.map((option) => {
              const key = configKey(group.category, option.name);
              const draft = drafts[key] ?? { status: option.minimum ? "PLANNED" : "NOT_NEEDED", notes: "" };
              const isSaving = pending && savingKey === key;
              const guide = providerGuide(group.category, option);
              const copy = statusCopy(draft.status, guide);
              const owner = ownerCopy(guide.owner);
              const canStartAuthorization = guide.owner !== "owner" || actorRole === "OPERATOR";
              const Icon = draft.status === "CONNECTED" ? ShieldCheck : draft.status === "PLANNED" ? modeIcon(guide.mode) : draft.status === "BLOCKED" ? LifeBuoy : SearchCheck;
              return (
                <div key={option.name} className="rounded-md border border-line bg-ink/40 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-ink-text">{option.name}</span>
                        {option.minimum && <span className="text-[10px] uppercase tracking-wider text-copper-soft">minimum</span>}
                        <span className={"rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider " + owner.className}>
                          {owner.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{option.role}</p>
                    </div>
                    <span className={"rounded-full border px-2 py-1 text-[10px] uppercase tracking-wider " + STATUS_STYLE[draft.status]}>
                      {copy.label}
                    </span>
                  </div>

                  <div className="mt-3 rounded-md border border-line bg-surface/70 px-3 py-3">
                    <div className="flex items-start gap-2">
                      <Icon size={15} className={draft.status === "CONNECTED" ? "mt-0.5 shrink-0 text-health-green" : "mt-0.5 shrink-0 text-copper-soft"} />
                      <div>
                        <p className="text-xs text-ink-text">{draft.status === "PLANNED" ? guide.headline : copy.detail}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          {draft.status === "PLANNED" ? guide.detail : `Unlocks: ${option.unlocks.join(", ")}`}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">{owner.detail}</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-muted">Unlocks: {option.unlocks.join(", ")}</p>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <div className="flex flex-wrap gap-2 sm:w-auto">
                      {draft.status === "CONNECTED" ? (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-health-green/40 bg-health-green/10 px-3 py-2 text-xs text-health-green"
                        >
                          <ShieldCheck size={13} /> Connected
                        </button>
                      ) : guide.href && canStartAuthorization ? (
                        <Link
                          href={guide.href}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20"
                        >
                          <PlugZap size={13} /> {guide.primaryLabel}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(key, {
                              status: nextStatus(draft.status, guide),
                              notes:
                                draft.notes ||
                                (guide.owner === "owner"
                                  ? `${option.name}: owner/operator authorization needed.`
                                  : guide.headline),
                            })
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20"
                        >
                          <PlugZap size={13} /> {guide.owner === "owner" && !canStartAuthorization ? "Request owner authorization" : guide.primaryLabel}
                        </button>
                      )}
                    </div>
                    <input
                      value={draft.notes}
                      onChange={(e) => updateDraft(key, { notes: e.target.value })}
                      placeholder="Support note, account owner, blocker, confirmed location..."
                      className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
                    />
                    <select
                      value={draft.status}
                      onChange={(e) => updateDraft(key, { status: e.target.value as DataSourceStatus })}
                      className={"w-full rounded-md border bg-surface px-2 py-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-copper-soft sm:w-auto " + STATUS_STYLE[draft.status]}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => save(group.category, option.name)}
                      disabled={isSaving}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20 disabled:opacity-50 sm:w-auto"
                    >
                      {savedKey === key ? <Check size={13} /> : <Save size={13} />}
                      {isSaving ? "Saving..." : savedKey === key ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
