import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type Summary = {
  accepted?: number;
  rejected?: number;
  missingUnitReferences?: string[];
  properties?: number;
  bookings?: number;
  ownerStatements?: number;
  expenses?: number;
  maintenanceIssues?: number;
  reviews?: number;
};

function asSummary(value: unknown): Summary {
  if (value && typeof value === "object") return value as Summary;
  return {};
}

export default async function RentalImportHistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const batches = role
    ? await prisma.vacationRentalImportBatch.findMany({
        where: { restaurantId: role.restaurantId },
        include: { source: { select: { providerName: true, kind: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-copper-soft">Rental import history</h1>
          <p className="mt-1 text-sm text-muted">
            {role?.restaurant?.name ?? "Your portfolio"} - recent rental import batches, accepted rows, rejected rows,
            and missing unit references.
          </p>
        </div>
        <Link href="/import/rentals" className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
          New import
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          No rental imports yet. Paste a pilot payload to create the first batch.
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const summary = asSummary(batch.summary);
            return (
              <div key={batch.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-[#E6E8E4]">{batch.sourceName}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {batch.source?.kind ?? "CSV"} - {batch.fileName || "manual payload"} - {batch.createdAt.toLocaleString()}
                    </div>
                  </div>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{batch.status}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
                  <Stat label="Accepted" value={summary.accepted ?? batch.acceptedCount} tone="text-health-green" />
                  <Stat label="Rejected" value={summary.rejected ?? batch.rejectedCount} tone={(summary.rejected ?? batch.rejectedCount) > 0 ? "text-health-red" : "text-muted"} />
                  <Stat label="Properties" value={summary.properties ?? 0} />
                  <Stat label="Bookings" value={summary.bookings ?? 0} />
                  <Stat label="Statements" value={summary.ownerStatements ?? 0} />
                  <Stat label="Issues" value={summary.maintenanceIssues ?? 0} />
                </div>

                {summary.missingUnitReferences && summary.missingUnitReferences.length > 0 && (
                  <p className="mt-3 text-[11px] leading-relaxed text-health-yellow">
                    Missing unit references: {summary.missingUnitReferences.join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, tone = "text-[#E6E8E4]" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={"tnum text-xl " + tone}>{value.toLocaleString()}</div>
    </div>
  );
}
