"use client";

import { useState, useTransition } from "react";
import { createRestaurant, type OnboardingInput } from "@/app/onboarding/actions";
import { INDUSTRY_TEMPLATES, type ProfileQuestion } from "@/lib/industry-templates";
import { sourceMapFor } from "@/lib/source-map";

const BUSINESS_TYPES = [
  INDUSTRY_TEMPLATES.RESTAURANT,
  INDUSTRY_TEMPLATES.SERVICE,
  INDUSTRY_TEMPLATES.CONTRACTOR,
  INDUSTRY_TEMPLATES.REAL_ESTATE_BROKERAGE,
  INDUSTRY_TEMPLATES.VACATION_RENTAL,
  INDUSTRY_TEMPLATES.RETAIL,
];

const TIERS: { key: OnboardingInput["tier"]; name: string; blurb: string; tag: string }[] = [
  { key: "TIER_1", name: "Guided live connections", blurb: "Use provider sign-ins where available; support handles technical setup.", tag: "Best" },
  { key: "TIER_2", name: "Bank-first start", blurb: "Connect the bank first, then add sales, accounting, and reputation sources.", tag: "Easy" },
  { key: "TIER_3", name: "Upload history", blurb: "Start with statements or exports when a direct connection is not ready.", tag: "Manual" },
  { key: "TIER_4", name: "Manual estimate first", blurb: "Use known numbers first and connect systems after the dashboard is useful.", tag: "Fallback" },
];

export function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<OnboardingInput["businessType"]>("RESTAURANT");
  const [sizeSignal, setSizeSignal] = useState("");
  const [profile, setProfile] = useState<Record<string, string | number | boolean | null>>({});
  const [tier, setTier] = useState<OnboardingInput["tier"]>("TIER_2");
  const [pending, startTransition] = useTransition();
  const selectedTemplate = INDUSTRY_TEMPLATES[businessType];
  const selectedSourceMap = sourceMapFor(businessType);

  const canContinue = name.trim().length > 1;

  function submit() {
    const profileWithDefaults = Object.fromEntries(
      selectedTemplate.profileQuestions
        .filter((question) => question.defaultValue !== undefined || profile[question.key] !== undefined)
        .map((question) => [question.key, profile[question.key] ?? question.defaultValue ?? null]),
    ) as Record<string, string | number | boolean | null>;

    startTransition(async () => {
      await createRestaurant({ name: name.trim(), businessType, scaleValue: Number(sizeSignal) || undefined, profile: profileWithDefaults, tier });
    });
  }

  function updateProfile(question: ProfileQuestion, value: string) {
    if (question.type === "boolean") {
      setProfile((current) => ({ ...current, [question.key]: value === "true" }));
      return;
    }
    if (question.type === "number" || question.type === "percent" || question.type === "money") {
      setProfile((current) => ({ ...current, [question.key]: value === "" ? null : Number(value) }));
      return;
    }
    setProfile((current) => ({ ...current, [question.key]: value }));
  }

  return (
    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-8">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Dot on={step >= 1} /> Details
        <span className="h-px w-6 bg-line" />
        <Dot on={step >= 2} /> Template
        <span className="h-px w-6 bg-line" />
        <Dot on={step >= 3} /> Setup path
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-display text-2xl text-copper-soft">Add your business</h1>
          <Field label="Business name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stone Grille & Taphouse"
              className="w-full rounded-md border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
            />
          </Field>
          <button
            disabled={!canContinue}
            onClick={() => setStep(2)}
            className="w-full rounded-md bg-copper px-4 py-2.5 font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h1 className="font-display text-2xl text-copper-soft">What kind of business is this?</h1>
          <p className="text-sm text-muted">
            This shapes the heartbeat and which modules show up first. You can refine it later.
          </p>
          <div className="space-y-2">
            {BUSINESS_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setBusinessType(t.key);
                  setProfile({});
                  setSizeSignal("");
                }}
                className={
                  "flex w-full items-start justify-between rounded-md border px-3 py-2.5 text-left " +
                  (businessType === t.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
                }
              >
                <span>
                  <span className="block text-sm text-ink-text">{t.label}</span>
                  <span className="block text-xs text-muted">{t.description}</span>
                </span>
                <span className="ml-3 max-w-[120px] text-right text-[10px] text-copper-soft">{t.primarySetup}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-text hover:border-copper-dim">
              Back
            </button>
            <button onClick={() => setStep(3)} className="flex-1 rounded-md bg-copper px-4 py-2.5 font-medium text-ink hover:bg-copper-soft">
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h1 className="font-display text-2xl text-copper-soft">How should setup begin?</h1>
          <p className="text-sm text-muted">Pick the starting path. After this, the app will show exactly what to connect or confirm.</p>
          <div className="rounded-md border border-line bg-ink px-3 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">{selectedTemplate.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-text">{selectedSourceMap.minimumAutoInput}</p>
          </div>
          <Field label={selectedTemplate.scaleAnchor.label}>
            <input
              value={sizeSignal}
              onChange={(e) => setSizeSignal(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder={`Number of ${selectedTemplate.scaleAnchor.unit}`}
              className="tnum w-full rounded-md border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
            />
          </Field>
          <div className="grid gap-3">
            {selectedTemplate.profileQuestions.slice(0, 3).map((question) => (
              <ProfileField
                key={question.key}
                question={question}
                value={profile[question.key] ?? question.defaultValue ?? ""}
                onChange={(value) => updateProfile(question, value)}
              />
            ))}
          </div>
          <div className="space-y-2">
            {TIERS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                className={
                  "flex w-full items-start justify-between rounded-md border px-3 py-2.5 text-left " +
                  (tier === t.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
                }
              >
                <span>
                  <span className="block text-sm text-ink-text">{t.name}</span>
                  <span className="block text-xs text-muted">{t.blurb}</span>
                </span>
                <span className="ml-3 rounded-full border border-copper-dim px-2 py-0.5 text-[10px] text-copper-soft">{t.tag}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-md border border-line px-4 py-2.5 text-sm text-ink-text hover:border-copper-dim">
              Back
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="flex-1 rounded-md bg-copper px-4 py-2.5 font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
            >
              {pending ? "Creating..." : "Create business"}
            </button>
          </div>
        </div>
      )}
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

  return (
    <Field label={question.label}>
      {question.type === "select" ? (
        <select
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
        >
          <option value="">Select one</option>
          {(question.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : question.type === "boolean" ? (
        <select
          value={stringValue || "false"}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          value={stringValue}
          onChange={(e) => onChange(question.type === "text" ? e.target.value : e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode={question.type === "text" ? "text" : "decimal"}
          placeholder={question.helper ?? ""}
          className="w-full rounded-md border border-line bg-ink px-3 py-2 text-ink-text outline-none focus:border-copper-soft focus-visible:ring-1 focus-visible:ring-copper-soft"
        />
      )}
    </Field>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={"h-2 w-2 rounded-full " + (on ? "bg-copper" : "bg-line")} />;
}
