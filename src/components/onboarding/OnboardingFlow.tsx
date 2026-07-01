"use client";

import { useState, useTransition } from "react";
import { createRestaurant, type OnboardingInput } from "@/app/onboarding/actions";
import type { BusinessType } from "@prisma/client";
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

const TIER_TAGS: Record<OnboardingInput["tier"], string> = {
  TIER_1: "Best",
  TIER_2: "Easy",
  TIER_3: "Manual",
  TIER_4: "Fallback",
};

const TIER_COPY: Record<
  BusinessType,
  Record<OnboardingInput["tier"], { name: string; blurb: string }>
> = {
  RESTAURANT: {
    TIER_1: { name: "Guided POS + bank setup", blurb: "Start with the core systems, then confirm each connection or support-assisted setup step." },
    TIER_2: { name: "Bank + POS first", blurb: "Start with bank and daily sales; add food cost, payroll, and reputation after the heartbeat appears." },
    TIER_3: { name: "Upload restaurant history", blurb: "Import statements or exports when POS and bank authorization are not ready." },
    TIER_4: { name: "Known restaurant numbers first", blurb: "Use rough weekly sales, labor, food, beverage, and fixed costs before connecting systems." },
  },
  SERVICE: {
    TIER_1: { name: "Guided bank + accounting setup", blurb: "Start with the core systems and let OutFront show what needs approval, upload, or support help." },
    TIER_2: { name: "Bank/accounting first", blurb: "Start with cash and invoices; add pipeline and utilization once the model is useful." },
    TIER_3: { name: "Upload service history", blurb: "Import statements or accounting exports before direct connections are ready." },
    TIER_4: { name: "Known service numbers first", blurb: "Use rough revenue, payroll, recurring costs, and receivables to get an initial read." },
  },
  CONTRACTOR: {
    TIER_1: { name: "Guided jobs + accounting setup", blurb: "Start with jobs, cash, accounting, payroll, and reputation sources in a guided setup path." },
    TIER_2: { name: "Bank/job-cost first", blurb: "Start with cash, materials, labor, and receivables; add schedule data next." },
    TIER_3: { name: "Upload job-cost history", blurb: "Import statements or accounting exports while job-system access is pending." },
    TIER_4: { name: "Known contractor numbers first", blurb: "Use backlog, materials, labor, subs, fixed costs, and AR to get a first read." },
  },
  REAL_ESTATE_BROKERAGE: {
    TIER_1: { name: "Guided brokerage source plan", blurb: "Plan accounting, bank, transaction, CRM, MLS, and reputation sources before authorizing anything sensitive." },
    TIER_2: { name: "Brokerage data import first", blurb: "Start with a CSV/export for agents, deals, splits, caps, and lead spend. No live APIs required." },
    TIER_3: { name: "Upload brokerage history", blurb: "Import brokerage exports before CRM, MLS, or transaction-system access is available." },
    TIER_4: { name: "Known brokerage numbers first", blurb: "Use agents, GCI, splits, lead spend, and closings to estimate company dollar." },
  },
  VACATION_RENTAL: {
    TIER_1: { name: "Guided PMS + booking setup", blurb: "Start with booking, bank, accounting, maintenance, and review sources in a guided setup path." },
    TIER_2: { name: "Bank/booking first", blurb: "Start with cash, occupancy, ADR, owner payouts, and property-level activity." },
    TIER_3: { name: "Upload rental data", blurb: "Import property, booking, owner-statement, expense, maintenance, or review exports." },
    TIER_4: { name: "Known rental numbers first", blurb: "Use properties, ADR, occupancy, fees, turns, maintenance, and owner proceeds." },
  },
  RETAIL: {
    TIER_1: { name: "Guided POS + inventory setup", blurb: "Start with sales, cash, inventory, accounting, and review sources in a guided setup path." },
    TIER_2: { name: "Bank/POS first", blurb: "Start with sales and cash; add inventory, ecommerce, and margin detail next." },
    TIER_3: { name: "Upload retail history", blurb: "Import statements, POS, ecommerce, or inventory exports before direct access is ready." },
    TIER_4: { name: "Known retail numbers first", blurb: "Use sales, gross margin, payroll, rent, inventory, returns, and traffic assumptions." },
  },
};

function setupTiers(type: BusinessType) {
  const copy = TIER_COPY[type];
  return (["TIER_1", "TIER_2", "TIER_3", "TIER_4"] as const).map((key) => ({ key, ...copy[key], tag: TIER_TAGS[key] }));
}

function businessNamePlaceholder(type: BusinessType): string {
  if (type === "REAL_ESTATE_BROKERAGE") return "Harbor & Main Realty";
  if (type === "VACATION_RENTAL") return "Shoreline Stay Group";
  if (type === "CONTRACTOR") return "Iron Ridge Field Services";
  if (type === "SERVICE") return "Keystone Service Co.";
  if (type === "RETAIL") return "Copper Lane Goods";
  return "Stone Grille & Taphouse";
}

export function OnboardingFlow({
  initialBusinessType = "RESTAURANT",
}: {
  initialBusinessType?: OnboardingInput["businessType"];
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<OnboardingInput["businessType"]>(initialBusinessType);
  const [sizeSignal, setSizeSignal] = useState("");
  const [profile, setProfile] = useState<Record<string, string | number | boolean | null>>({});
  const [tier, setTier] = useState<OnboardingInput["tier"]>("TIER_2");
  const [pending, startTransition] = useTransition();
  const selectedTemplate = INDUSTRY_TEMPLATES[businessType];
  const selectedSourceMap = sourceMapFor(businessType);
  const tiers = setupTiers(businessType);

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
    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Dot on={step >= 1} /> Details
        <span className="h-px w-6 bg-line" />
        <Dot on={step >= 2} /> Template
        <span className="h-px w-6 bg-line" />
        <Dot on={step >= 3} /> Setup path
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-display text-2xl text-copper-soft">Add your business</h1>
          <p className="rounded-md border border-line bg-ink/60 px-3 py-2 text-xs leading-relaxed text-muted">
            A phone is fine for this first pass. Full source authorization, file imports, and cleanup are easier on a
            computer.
          </p>
          <Field label="Business name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={businessNamePlaceholder(businessType)}
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
                  "flex w-full flex-col gap-2 rounded-md border px-3 py-2.5 text-left sm:flex-row sm:items-start sm:justify-between " +
                  (businessType === t.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
                }
              >
                <span>
                  <span className="block text-sm text-ink-text">{t.label}</span>
                  <span className="block text-xs text-muted">{t.description}</span>
                </span>
                <span className="max-w-none text-left text-[10px] text-copper-soft sm:ml-3 sm:max-w-[120px] sm:text-right">{t.primarySetup}</span>
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
          {businessType === "REAL_ESTATE_BROKERAGE" && (
            <p className="rounded-md border border-copper-dim/50 bg-copper/10 px-3 py-2 text-xs leading-relaxed text-copper-soft">
              Brokerage setup can begin without live API keys. A CSV/export of agents, deals, splits, caps, and lead
              spend is enough to light up Company Dollar, pipeline, Agent Performance, and Lead ROI.
            </p>
          )}
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
            {selectedTemplate.profileQuestions.map((question) => (
              <ProfileField
                key={question.key}
                question={question}
                value={profile[question.key] ?? question.defaultValue ?? ""}
                onChange={(value) => updateProfile(question, value)}
              />
            ))}
          </div>
          <div className="space-y-2">
            {tiers.map((t) => (
              <button
                key={t.key}
                onClick={() => setTier(t.key)}
                className={
                  "flex w-full flex-col gap-2 rounded-md border px-3 py-2.5 text-left sm:flex-row sm:items-start sm:justify-between " +
                  (tier === t.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
                }
              >
                <span>
                  <span className="block text-sm text-ink-text">{t.name}</span>
                  <span className="block text-xs text-muted">{t.blurb}</span>
                </span>
                <span className="w-fit rounded-full border border-copper-dim px-2 py-0.5 text-[10px] text-copper-soft sm:ml-3">{t.tag}</span>
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
