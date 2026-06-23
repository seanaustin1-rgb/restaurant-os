import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { BusinessType } from "@prisma/client";
import { SignUpButton } from "@clerk/nextjs";
import { getDemoBistroId } from "@/lib/demo/demo-tenant";
import { demoPrisma } from "@/lib/demo/demo-prisma";
import { loadDashboardData } from "@/lib/dashboard/data";
import { buildDemoTourData } from "@/lib/demo/tour-data";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { industryTemplateFor } from "@/lib/industry-templates";

const ROUTES: Record<string, BusinessType> = {
  restaurant: "RESTAURANT",
  service: "SERVICE",
  contractor: "CONTRACTOR",
  "real-estate": "REAL_ESTATE_BROKERAGE",
  "vacation-rental": "VACATION_RENTAL",
  retail: "RETAIL",
};

const ESTIMATE_HREF: Partial<Record<BusinessType, string>> = {
  RESTAURANT: "/demo",
  SERVICE: "/demo/service",
  REAL_ESTATE_BROKERAGE: "/demo/real-estate",
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { type: string } }): Promise<Metadata> {
  const businessType = ROUTES[params.type];
  if (!businessType) return { title: "Demo tour - OutFront Data" };
  const template = industryTemplateFor(businessType);
  return {
    title: `${template.label} demo tour - OutFront Data`,
    description: `Tour a realistic ${template.label.toLowerCase()} dashboard with no login required.`,
  };
}

export default async function DemoTemplateTourPage({ params }: { params: { type: string } }) {
  const businessType = ROUTES[params.type];
  if (!businessType) notFound();

  const db = demoPrisma;
  const restaurantId = db ? await getDemoBistroId(db).catch(() => null) : null;
  const template = industryTemplateFor(businessType);
  const estimateHref = ESTIMATE_HREF[businessType];

  const data = restaurantId && db ? await loadDashboardData(restaurantId, db).catch(() => null) : null;
  const displayData = data ?? buildDemoTourData(businessType);

  return (
    <div>
      <div className="border-b border-copper-dim/40 bg-copper-dim/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
          <p className="text-[13px] text-[#CFD2CC]">
            <span className="font-medium text-copper-soft">{template.label} tour</span> - a fictional company with
            realistic sample numbers already loaded.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <Link href="/demo/tour" className="rounded-md border border-line px-3 py-1.5 font-medium text-copper-soft hover:border-copper">
              Change business type
            </Link>
            {estimateHref && (
              <Link href={estimateHref} className="rounded-md border border-copper-dim bg-copper/10 px-3 py-1.5 font-medium text-copper-soft hover:bg-copper/20">
                Enter your numbers
              </Link>
            )}
            <SignUpButton forceRedirectUrl="/onboarding">
              <button
                type="button"
                className="rounded-md bg-copper px-3 py-1.5 font-medium text-ink hover:bg-copper-soft"
              >
                Start free
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>

      <DashboardView dashboards={[displayData]} moduleOrder={null} pinnedModules={[]} demoMode initialPreviewType={businessType} />
    </div>
  );
}
