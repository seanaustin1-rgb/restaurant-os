"use client";

import { useState, useTransition } from "react";
import { createRestaurant, type OnboardingInput } from "@/app/onboarding/actions";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

const BUSINESS_TYPES = [
  INDUSTRY_TEMPLATES.RESTAURANT,
  INDUSTRY_TEMPLATES.SERVICE,
  INDUSTRY_TEMPLATES.CONTRACTOR,
  INDUSTRY_TEMPLATES.REAL_ESTATE_BROKERAGE,
  INDUSTRY_TEMPLATES.VACATION_RENTAL,
  INDUSTRY_TEMPLATES.RETAIL,
];

const TIERS: { key: OnboardingInput["tier"]; name: string; blurb: string; tag: string }[] = [
  { key: "TIER_1", name: "POS + Food Cost", blurb: "MarginEdge + Toast/Clover. Automatic, real-time.", tag: "Best" },
  { key: "TIER_2", name: "Bank Connection", blurb: "Link your bank via Plaid. Automatic, next-day.", tag: "Easy" },
  { key: "TIER_3", name: "Statement Upload", blurb: "Drop a PDF/CSV statement monthly.", tag: "Manual" },
  { key: "TIER_4", name: "Manual Entry", blurb: "Type the numbers in. Always available.", tag: "Fallback" },
];

export function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<OnboardingInput["businessType"]>("RESTAURANT");
  const [seatCount, setSeatCount] = useState("");
  const [tier, setTier] = useState<OnboardingInput["tier"]>("TIER_2");
  const [pending, startTransition] = useTransition();

  const canContinue = name.trim().length > 1;

  function submit() {
    startTransition(async () => {
      await createRestaurant({ name: name.trim(), businessType, seatCount: Number(seatCount) || 0, tier });
    });
  }

  return (
    <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-8">
      <div className="mb-6 flex items-center gap-2 text-xs text-muted">
        <Dot on={step >= 1} /> Details
        <span className="h-px w-6 bg-line" />
        <Dot on={step >= 2} /> Template
        <span className="h-px w-6 bg-line" />
        <Dot on={step >= 3} /> Data source
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <h1 className="font-display text-2xl text-copper-soft">Add your business</h1>
          <Field label="Business name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stone Grille & Taphouse"
              className="w-full rounded-md border border-line bg-ink px-3 py-2 text-[#E6E8E4] outline-none focus:border-copper-dim"
            />
          </Field>
          <Field label="Seat count / team size (optional)">
            <input
              value={seatCount}
              onChange={(e) => setSeatCount(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="215"
              className="tnum w-full rounded-md border border-line bg-ink px-3 py-2 text-[#E6E8E4] outline-none focus:border-copper-dim"
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
                onClick={() => setBusinessType(t.key)}
                className={
                  "flex w-full items-start justify-between rounded-md border px-3 py-2.5 text-left " +
                  (businessType === t.key ? "border-copper bg-copper/10" : "border-line bg-ink hover:border-copper-dim")
                }
              >
                <span>
                  <span className="block text-sm text-[#E6E8E4]">{t.label}</span>
                  <span className="block text-xs text-muted">{t.description}</span>
                </span>
                <span className="ml-3 max-w-[120px] text-right text-[10px] text-copper-soft">{t.primarySetup}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-md border border-line px-4 py-2.5 text-sm text-[#E6E8E4] hover:border-copper-dim">
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
          <h1 className="font-display text-2xl text-copper-soft">How will data flow in?</h1>
          <p className="text-sm text-muted">Pick where your numbers come from. You can change this later — nobody gets turned away.</p>
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
                  <span className="block text-sm text-[#E6E8E4]">{t.name}</span>
                  <span className="block text-xs text-muted">{t.blurb}</span>
                </span>
                <span className="ml-3 rounded-full border border-copper-dim px-2 py-0.5 text-[10px] text-copper-soft">{t.tag}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-md border border-line px-4 py-2.5 text-sm text-[#E6E8E4] hover:border-copper-dim">
              Back
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="flex-1 rounded-md bg-copper px-4 py-2.5 font-medium text-ink hover:bg-copper-soft disabled:opacity-40"
            >
              {pending ? "Creating…" : "Create business"}
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

function Dot({ on }: { on: boolean }) {
  return <span className={"h-2 w-2 rounded-full " + (on ? "bg-copper" : "bg-line")} />;
}
