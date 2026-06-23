import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { money, pct } from "@/lib/format";
import { computePropertyPortfolio } from "@/lib/demo/property-portfolio";
import { buildPropertyActionQueue } from "@/lib/demo/property-action-queue";
import { computeVacationRentalImportReadiness } from "@/lib/demo/vacation-rental-import-readiness";

const samplePortfolio = computePropertyPortfolio([
  {
    name: "Lake House",
    monthlyBookingRevenue: 18000,
    occupancyPct: 72,
    averageDailyRate: 325,
    cleaningCosts: 2100,
    maintenanceCosts: 1400,
    platformFees: 900,
    managementFeePct: 18,
    ownerReserveTarget: 8000,
    openIssues: 1,
    repeatIssues: 0,
    avgResponseHours: 3,
    reviewRating: 4.8,
    futureBookedNights: 18,
    next30AvailableNights: 28,
  },
  {
    name: "Beach Cottage",
    monthlyBookingRevenue: 21000,
    occupancyPct: 78,
    averageDailyRate: 410,
    cleaningCosts: 2400,
    maintenanceCosts: 1100,
    platformFees: 1100,
    managementFeePct: 18,
    ownerReserveTarget: 9500,
    openIssues: 0,
    repeatIssues: 0,
    avgResponseHours: 2,
    reviewRating: 4.9,
    futureBookedNights: 21,
    next30AvailableNights: 27,
  },
  {
    name: "Downtown Condo",
    monthlyBookingRevenue: 9000,
    occupancyPct: 44,
    averageDailyRate: 180,
    cleaningCosts: 1700,
    maintenanceCosts: 2600,
    platformFees: 650,
    managementFeePct: 20,
    ownerReserveTarget: 5000,
    openIssues: 5,
    repeatIssues: 2,
    avgResponseHours: 24,
    reviewRating: 3.9,
    futureBookedNights: 7,
    next30AvailableNights: 25,
  },
]);

const readiness = computeVacationRentalImportReadiness({
  unitCount: 1000,
  annualBookings: 14000,
  sources: [
    {
      name: "Escapia",
      capabilities: ["propertyManagers", "unitInventory", "rates", "feesTaxes", "bookingRestrictions", "bookingChannels"],
    },
    {
      name: "Owner statements export",
      capabilities: ["ownerStatements", "propertyExpenses"],
    },
  ],
});

export default async function RentalPilotReportsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const actions = buildPropertyActionQueue(samplePortfolio.properties, 5);
  const ownerProperty = samplePortfolio.properties[0];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-copper-soft">Rental pilot reports</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Sample report shapes for the vacation-rental pilot: owner property readout, operator portfolio readout,
            and import quality readout. These use sample data until real exports arrive.
          </p>
        </div>
        <Link href="/import/rentals" className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
          Test import
        </Link>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="text-[11px] uppercase tracking-wider text-copper-soft">Owner-facing sample</div>
        <h2 className="mt-1 font-display text-xl text-[#E6E8E4]">{ownerProperty.name}</h2>
        <p className="mt-1 text-sm text-muted">{ownerProperty.note}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Owner proceeds" value={money(ownerProperty.ownerProceeds)} />
          <Stat label="Reserve cushion" value={money(ownerProperty.reserveCushion)} />
          <Stat label="Occupancy" value={pct(ownerProperty.occupancyPct, 0)} />
          <Stat label="ADR" value={money(ownerProperty.averageDailyRate)} />
          <Stat label="Guest Aura" value={Math.round(ownerProperty.guestAuraScore).toLocaleString()} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="text-[11px] uppercase tracking-wider text-copper-soft">Operator portfolio sample</div>
        <h2 className="mt-1 font-display text-xl text-[#E6E8E4]">Properties needing attention</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Properties" value={samplePortfolio.propertyCount.toLocaleString()} />
          <Stat label="Booking revenue" value={money(samplePortfolio.monthlyBookingRevenue)} />
          <Stat label="Owner proceeds" value={money(samplePortfolio.ownerProceeds)} />
          <Stat label="Maintenance drag" value={pct(samplePortfolio.maintenancePressurePct)} />
          <Stat label="Pressure count" value={samplePortfolio.pressureCount.toLocaleString()} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {actions.map((action) => (
            <div key={`${action.propertyName}-${action.kind}`} className="rounded-lg border border-line bg-ink/60 p-3">
              <div className="text-sm text-[#E6E8E4]">{action.title}</div>
              <div className="text-[11px] text-muted">{action.propertyName}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{action.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="text-[11px] uppercase tracking-wider text-copper-soft">Import quality sample</div>
        <h2 className="mt-1 font-display text-xl text-[#E6E8E4]">{Math.round(readiness.overallCoveragePct)}% mapped</h2>
        <p className="mt-1 text-sm text-muted">
          Next best source: <span className="text-copper-soft">{readiness.nextBestSource}</span>
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {readiness.layers.map((layer) => (
            <div key={layer.key} className="rounded-lg border border-line bg-ink/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-[#E6E8E4]">{layer.label}</div>
                <div className="tnum text-sm text-copper-soft">{Math.round(layer.coveragePct)}%</div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{layer.note}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tnum text-xl text-[#E6E8E4]">{value}</div>
    </div>
  );
}
