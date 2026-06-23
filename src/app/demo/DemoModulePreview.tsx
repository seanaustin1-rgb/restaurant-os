import Link from "next/link";
import type { BusinessType } from "@prisma/client";
import { Info, Lock } from "lucide-react";
import { industryTemplateFor } from "@/lib/industry-templates";
import { MODULES } from "@/lib/modules";

const TOUR_HREF: Record<BusinessType, string> = {
  RESTAURANT: "/demo/tour/restaurant",
  SERVICE: "/demo/tour/service",
  CONTRACTOR: "/demo/tour/contractor",
  REAL_ESTATE_BROKERAGE: "/demo/tour/real-estate",
  VACATION_RENTAL: "/demo/tour/vacation-rental",
  RETAIL: "/demo/tour/retail",
};

export function DemoModulePreview({ businessType }: { businessType: BusinessType }) {
  const template = industryTemplateFor(businessType);
  const modules = template.defaultModuleKeys
    .map((key) => MODULES.find((module) => module.key === key))
    .filter((module): module is NonNullable<typeof module> => Boolean(module));

  return (
    <section className="mt-8 rounded-xl border border-line bg-surface px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-copper-soft">Dashboard modules</div>
          <h3 className="mt-1 font-display text-xl text-[#E6E8E4]">{template.label} module map</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
            Your quick estimate lights up the first read. These are the modules the full dashboard uses as live sources are connected.
          </p>
        </div>
        <Link href={TOUR_HREF[businessType]} className="rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 text-xs font-medium text-copper-soft hover:bg-copper/20">
          See full tour
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          const live = module.status === "live";
          return (
            <div key={module.key} className={"rounded-lg border px-3 py-3 " + (live ? "border-line bg-ink/50" : "border-line/70 bg-ink/30")}>
              <div className="flex items-start justify-between gap-2">
                <div className={live ? "text-sm text-[#E6E8E4]" : "text-sm text-muted"}>{module.name}</div>
                <span className={"inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] " + (live ? "border-health-green/30 text-health-green" : "border-line text-muted")}>
                  {live ? <Info size={9} /> : <Lock size={9} />}
                  {live ? "live" : "needs data"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{module.description}</p>
              {!live && module.blockedBy && <p className="mt-2 text-[10px] text-muted/70">Unlocks with {module.blockedBy}.</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
