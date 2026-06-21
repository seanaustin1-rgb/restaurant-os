import Link from "next/link";
import { Building2, PlugZap, Settings2 } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard/data";
import { industryTemplateFor } from "@/lib/industry-templates";

export function SetupOverviewCard({ data }: { data: DashboardData }) {
  const template = industryTemplateFor(data.businessType);
  const setup = data.sourceSetup;
  const missing = setup.missingRequired.slice(0, 3).join(", ");
  const statusLine =
    setup.connectedCount > 0
      ? `${setup.connectedCount} connected, ${setup.plannedCount} planned, ${setup.blockedCount} blocked`
      : `Minimum sources to plan: ${setup.requiredCount}`;

  return (
    <section className="rounded-lg border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Building2 size={13} /> Business setup
          </p>
          <h2 className="mt-1 font-display text-xl text-copper-soft">{template.label}</h2>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted">{template.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/business"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-copper-soft hover:border-copper"
          >
            <Settings2 size={13} /> Template
          </Link>
          <Link
            href="/settings/sources"
            className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-xs text-copper-soft hover:bg-copper/20"
          >
            <PlugZap size={13} /> Source Map
          </Link>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Minimum auto-input</p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#E6E8E4]">{setup.minimumAutoInput}</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Source progress</p>
          <p className="mt-1 text-sm text-[#E6E8E4]">{statusLine}</p>
          <p className="mt-0.5 text-[11px] text-muted">{setup.notNeededCount} marked not needed</p>
        </div>
        <div className="rounded-md border border-line bg-ink/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted">Missing minimum</p>
          <p className="mt-1 line-clamp-2 text-sm text-[#E6E8E4]">
            {setup.missingRequired.length > 0 ? missing : "Minimum source plan is connected."}
          </p>
          {setup.missingRequired.length > 3 && <p className="mt-0.5 text-[11px] text-muted">+{setup.missingRequired.length - 3} more</p>}
        </div>
      </div>
    </section>
  );
}
