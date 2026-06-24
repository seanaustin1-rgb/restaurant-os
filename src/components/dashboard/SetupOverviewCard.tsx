"use client";

import Link from "next/link";
import { Building2, ChevronDown, PlugZap, Settings2 } from "lucide-react";
import type { BusinessType } from "@prisma/client";
import type { DashboardData } from "@/lib/dashboard/data";
import { INDUSTRY_TEMPLATES, industryTemplateFor } from "@/lib/industry-templates";
import { EnterNumbersButton } from "@/components/demo/EnterNumbersButton";

const TEMPLATE_OPTIONS = [
  INDUSTRY_TEMPLATES.RESTAURANT,
  INDUSTRY_TEMPLATES.SERVICE,
  INDUSTRY_TEMPLATES.CONTRACTOR,
  INDUSTRY_TEMPLATES.REAL_ESTATE_BROKERAGE,
  INDUSTRY_TEMPLATES.VACATION_RENTAL,
  INDUSTRY_TEMPLATES.RETAIL,
];

function demoEstimateFor(type: BusinessType): { href: string; label: string } | null {
  if (type === "RESTAURANT") return { href: "/demo", label: "Enter restaurant numbers" };
  if (type === "SERVICE") return { href: "/demo/service", label: "Enter service numbers" };
  if (type === "REAL_ESTATE_BROKERAGE") return { href: "/demo/real-estate", label: "Enter brokerage numbers" };
  if (type === "RETAIL") return { href: "/demo/retail", label: "Enter retail numbers" };
  if (type === "VACATION_RENTAL") return { href: "/demo/vacation-rental", label: "Enter rental numbers" };
  if (type === "CONTRACTOR") return { href: "/demo/contractor", label: "Enter contractor numbers" };
  return null;
}

export function SetupOverviewCard({
  data,
  previewType,
  onPreviewTypeChange,
  isPreview,
  demoMode = false,
}: {
  data: DashboardData;
  previewType: BusinessType;
  onPreviewTypeChange: (type: BusinessType) => void;
  isPreview: boolean;
  demoMode?: boolean;
}) {
  const template = industryTemplateFor(data.businessType);
  const demoEstimate = demoEstimateFor(data.businessType);
  const setup = data.sourceSetup;
  const missing = setup.missingRequired.slice(0, 3).join(", ");
  const setupLabel = demoMode ? "Demo setup" : "Business setup";
  const description = demoMode
    ? `This tour is showing a sample ${template.label.toLowerCase()} view. Explore the heartbeat first; source connections come later.`
    : template.description;
  const minimumLabel = demoMode ? "Sample data included" : "Minimum auto-input";
  const minimumText = demoMode
    ? "No bank, POS, or accounting connection is required to use this public demo."
    : setup.minimumAutoInput;
  const progressLabel = demoMode ? "Demo status" : "Source progress";
  const statusLine =
    demoMode
      ? "Ready to explore"
      : setup.connectedCount > 0
      ? `${setup.connectedCount} connected, ${setup.plannedCount} planned, ${setup.blockedCount} blocked`
      : `Minimum sources to plan: ${setup.requiredCount}`;
  const progressSubtext = demoMode ? `Sample ${template.label.toLowerCase()} data is loaded` : `${setup.notNeededCount} marked not needed`;
  const missingLabel = demoMode ? "After signup" : "Missing minimum";
  const missingText = demoMode
    ? "Connect real sources only when you want your own live dashboard."
    : setup.missingRequired.length > 0
      ? missing
      : "Minimum source plan is connected.";

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Building2 size={13} /> {setupLabel}
          </p>
          <h2 className="mt-1 font-display text-xl text-copper-soft">{template.label}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted">{description}</p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <label className="block rounded-md border border-copper-dim bg-ink/60 px-3 py-2 sm:min-w-[300px]">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
              <ChevronDown size={12} /> Meeting preview
            </span>
            <select
              value={previewType}
              onChange={(e) => onPreviewTypeChange(e.target.value as BusinessType)}
              className="w-full rounded-md border border-line bg-surface px-2 py-2 text-sm text-copper-soft outline-none focus:border-copper-dim"
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {!demoMode && (
            <>
              <Link
                href="/settings/business"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs text-copper-soft hover:border-copper"
              >
                <Settings2 size={13} /> Template
              </Link>
              <Link
                href="/settings/sources"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20"
              >
                <PlugZap size={13} /> Source Map
              </Link>
            </>
          )}
          {demoMode && demoEstimate && (
            <EnterNumbersButton
              href={demoEstimate.href}
              label={demoEstimate.label}
              helper="See this dashboard with your own figures"
            />
          )}
          {demoMode && !demoEstimate && (
            <span className="inline-flex items-center justify-center rounded-md border border-line px-3 py-2 text-xs text-muted">
              Preview only
            </span>
          )}
        </div>
      </div>

      {isPreview && (
        <div className="mt-3 rounded-md border border-copper-dim/50 bg-copper/10 px-3 py-2 text-xs leading-relaxed text-copper-soft">
          Previewing this dashboard as a {template.label.toLowerCase()}. This does not change the saved business template.
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">{minimumLabel}</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#E6E8E4]">{minimumText}</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">{progressLabel}</p>
          <p className="mt-1 text-sm text-[#E6E8E4]">{statusLine}</p>
          <p className="mt-0.5 text-[11px] text-muted">{progressSubtext}</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">{missingLabel}</p>
          <p className="mt-1 line-clamp-2 text-sm text-[#E6E8E4]">
            {missingText}
          </p>
          {!demoMode && setup.missingRequired.length > 3 && <p className="mt-0.5 text-[11px] text-muted">+{setup.missingRequired.length - 3} more</p>}
        </div>
      </div>
    </section>
  );
}
