"use client";

import { useState, useTransition } from "react";
import type { BusinessType, UserRole } from "@prisma/client";
import Link from "next/link";
import { Check, Settings2 } from "lucide-react";
import { updateBusinessTemplate } from "@/app/settings/business/actions";
import { INDUSTRY_TEMPLATES, type ProfileQuestion } from "@/lib/industry-templates";

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

function profileFromJson(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const profile: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null) {
      profile[key] = entry;
    }
  }
  return profile;
}

function valueFor(profile: Record<string, string | number | boolean | null>, question: ProfileQuestion) {
  return profile[question.key] ?? question.defaultValue ?? "";
}

export function BusinessTemplateForm({
  initialBusinessType,
  initialProfile,
  initialSeatCount,
  actorRole,
}: {
  initialBusinessType: BusinessType;
  initialProfile: unknown;
  initialSeatCount: number | null;
  actorRole: UserRole;
}) {
  const [businessType, setBusinessType] = useState<BusinessType>(initialBusinessType);
  const [profile, setProfile] = useState<Record<string, string | number | boolean | null>>(() => profileFromJson(initialProfile));
  const [applyRecommendedModules, setApplyRecommendedModules] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedDetail, setSavedDetail] = useState("");
  const [pending, startTransition] = useTransition();
  const selected = INDUSTRY_TEMPLATES[businessType];
  const scaleValue = profile[selected.scaleAnchor.key] ?? (selected.scaleAnchor.key === "seatCount" ? initialSeatCount : "");

  function save() {
    const profileWithDefaults = Object.fromEntries(
      selected.profileQuestions
        .filter((question) => question.defaultValue !== undefined || profile[question.key] !== undefined)
        .map((question) => [question.key, profile[question.key] ?? question.defaultValue ?? null]),
    ) as Record<string, string | number | boolean | null>;

    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateBusinessTemplate({
          businessType,
          applyRecommendedModules,
          scaleValue: typeof scaleValue === "number" ? scaleValue : Number(scaleValue) || null,
          profile: profileWithDefaults,
        });
        setSavedDetail(
          applyRecommendedModules
            ? "Template and dashboard modules were updated."
            : "Template assumptions were saved. Dashboard modules were left unchanged.",
        );
        setSaved(true);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  function updateProfile(key: string, value: string | number | boolean | null) {
    setSaved(false);
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateQuestion(question: ProfileQuestion, value: string) {
    if (question.type === "boolean") {
      updateProfile(question.key, value === "true");
      return;
    }
    if (question.type === "number" || question.type === "percent" || question.type === "money") {
      updateProfile(question.key, value === "" ? null : Number(value));
      return;
    }
    updateProfile(question.key, value);
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
            <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-text">
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
                setProfile({});
                setSaved(false);
              }}
              className={
                "flex w-full items-start justify-between gap-3 rounded-md border px-3 py-3 text-left transition-colors " +
                (businessType === template.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
              }
            >
              <span>
                <span className="block text-sm text-ink-text">{template.label}</span>
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink-text">Business assumptions</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              These are setup assumptions consultants and accountants can tune as they learn the business. They shape
              onboarding context and future sector-specific reads; they do not move money by themselves.
            </p>
          </div>
          <span className="rounded-full border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-muted">
            editable
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          <Field label={selected.scaleAnchor.label}>
            <input
              value={scaleValue == null ? "" : String(scaleValue)}
              onChange={(e) => updateProfile(selected.scaleAnchor.key, e.target.value === "" ? null : Number(e.target.value.replace(/[^0-9.]/g, "")))}
              inputMode="decimal"
              placeholder={`Number of ${selected.scaleAnchor.unit}`}
              className="tnum w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
            />
          </Field>

          {selected.profileQuestions.map((question) => (
            <ProfileField
              key={question.key}
              question={question}
              value={valueFor(profile, question)}
              onChange={(value) => updateQuestion(question, value)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink-text">Apply recommended module setup</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              When this is on, the dashboard is reset to the module set that best fits this business type. When it is
              off, only the business assumptions are saved and the current dashboard modules stay as they are. Existing
              data is not deleted either way.
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
          <p className="text-[11px] uppercase tracking-wider text-muted">
            {applyRecommendedModules ? "Will apply these modules" : "Modules will stay unchanged"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-text">
            {applyRecommendedModules
              ? selected.defaultModuleKeys.join(", ")
              : "Turn the checkbox on if you want this page to replace the current dashboard module set."}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save template"}
        </button>
        {saved && !pending && (
          <>
            <span className="inline-flex items-center gap-1 text-sm text-health-green">
              <Check size={14} /> {savedDetail || "Saved"}
            </span>
            <Link href="/onboarding" className="rounded-md border border-line px-3 py-2 text-sm text-ink-text hover:border-copper-dim">
              Back to setup steps
            </Link>
            <Link href="/dashboard" className="rounded-md border border-copper-dim px-3 py-2 text-sm text-copper-soft hover:border-copper">
              View dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

function ProfileField({
  question,
  value,
  onChange,
}: {
  question: ProfileQuestion;
  value: string | number | boolean;
  onChange: (value: string) => void;
}) {
  const stringValue = typeof value === "boolean" ? String(value) : String(value ?? "");
  const inputClass =
    "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft";

  return (
    <Field label={question.label}>
      {question.type === "select" ? (
        <select value={stringValue} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="">Select one</option>
          {(question.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : question.type === "boolean" ? (
        <select value={stringValue || "false"} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          value={stringValue}
          onChange={(e) => onChange(question.type === "text" ? e.target.value : e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode={question.type === "text" ? "text" : "decimal"}
          placeholder={question.helper ?? ""}
          className={inputClass}
        />
      )}
    </Field>
  );
}
