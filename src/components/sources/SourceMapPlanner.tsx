"use client";

import { useMemo, useState, useTransition } from "react";
import type { DataSourceStatus } from "@prisma/client";
import { Check, Save } from "lucide-react";
import { updateSourceConfig } from "@/app/settings/sources/actions";
import type { BusinessSourceMap, SourceCategory } from "@/lib/source-map";

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

function configKey(category: string, providerName: string) {
  return `${category}::${providerName}`;
}

function errMsg(error: unknown) {
  return error instanceof Error ? error.message : "Could not save source setup.";
}

export function SourceMapPlanner({
  sourceMap,
  initialConfigs,
}: {
  sourceMap: BusinessSourceMap;
  initialConfigs: SourceConfigSnapshot[];
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
              <h2 className="text-sm font-medium text-[#E6E8E4]">{group.label}</h2>
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
              return (
                <div key={option.name} className="rounded-md border border-line bg-ink/40 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[#E6E8E4]">{option.name}</span>
                        {option.minimum && <span className="text-[10px] uppercase tracking-wider text-copper-soft">minimum</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{option.role}</p>
                    </div>
                    <select
                      value={draft.status}
                      onChange={(e) => updateDraft(key, { status: e.target.value as DataSourceStatus })}
                      className={"rounded-md border bg-surface px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-copper-soft " + STATUS_STYLE[draft.status]}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-muted">Unlocks: {option.unlocks.join(", ")}</p>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={draft.notes}
                      onChange={(e) => updateDraft(key, { notes: e.target.value })}
                      placeholder="Setup note, credential owner, blocker..."
                      className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs text-[#E6E8E4] outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
                    />
                    <button
                      type="button"
                      onClick={() => save(group.category, option.name)}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20 disabled:opacity-50"
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
