"use client";

import { useState, useTransition } from "react";
import type { BusinessType, UserRole } from "@prisma/client";
import { Check, Settings2 } from "lucide-react";
import { updateBusinessTemplate } from "@/app/settings/business/actions";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

const TEMPLATES = [
  INDUSTRY_TEMPLATES.RESTAURANT,
  INDUSTRY_TEMPLATES.SERVICE,
  INDUSTRY_TEMPLATES.CONTRACTOR,
  INDUSTRY_TEMPLATES.REAL_ESTATE_BROKERAGE,
  INDUSTRY_TEMPLATES.VACATION_RENTAL,
  INDUSTRY_TEMPLATES.RETAIL,
];

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : "Could not update business template.";
}

export function BusinessTemplateForm({
  initialBusinessType,
  actorRole,
}: {
  initialBusinessType: BusinessType;
  actorRole: UserRole;
}) {
  const [businessType, setBusinessType] = useState<BusinessType>(initialBusinessType);
  const [applyRecommendedModules, setApplyRecommendedModules] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = INDUSTRY_TEMPLATES[businessType];

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateBusinessTemplate({ businessType, applyRecommendedModules });
        setSaved(true);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-sm text-health-red">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-[#E6E8E4]">
              <Settings2 size={15} /> Template selection
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Current editor role: {actorRole.toLowerCase()}. Consultants can use this to push a cleaner setup to a
              client before reviewing the dashboard together.
            </p>
          </div>
          <span className="rounded-full border border-copper-dim px-2 py-1 text-[10px] uppercase tracking-wider text-copper-soft">
            {selected.label}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {TEMPLATES.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => {
                setBusinessType(template.key);
                setSaved(false);
              }}
              className={
                "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors " +
                (businessType === template.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
              }
            >
              <span>
                <span className="block text-sm text-[#E6E8E4]">{template.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{template.description}</span>
              </span>
              <span className="max-w-[140px] shrink-0 text-right text-[10px] text-copper-soft">
                {template.primarySetup}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-[#E6E8E4]">Apply recommended module setup</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Turns on this template&apos;s recommended modules and de-emphasizes modules that do not fit the selected
              business type. Existing data is not deleted.
            </span>
          </span>
          <input
            type="checkbox"
            checked={applyRecommendedModules}
            onChange={(e) => {
              setApplyRecommendedModules(e.target.checked);
              setSaved(false);
            }}
            className="mt-1 h-4 w-4 accent-copper"
          />
        </label>

        <div className="mt-3 rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-muted">Recommended modules</p>
          <p className="mt-1 text-xs leading-relaxed text-[#E6E8E4]">{selected.defaultModuleKeys.join(", ")}</p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save template"}
        </button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-sm text-health-green">
            <Check size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
