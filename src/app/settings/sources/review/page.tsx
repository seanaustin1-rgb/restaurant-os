import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { loadPendingFinancialEvents } from "@/lib/financial-ledger/review";
import { approveFinancialEventAction, excludeFinancialEventAction } from "./actions";

const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function confidenceLabel(value: number) {
  if (value <= 0) return "unmapped";
  return `${Math.round(value * 100)}%`;
}

export default async function FinancialMappingReviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { restaurantId: true, role: true, restaurant: { select: { name: true } } },
  });
  if (!role) redirect("/dashboard");

  const pending = await loadPendingFinancialEvents(prisma, role.restaurantId);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-lg border border-copper-dim/40 bg-surface p-5">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <Database size={14} /> Clean ledger review
        </p>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Financial Mapping Review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          {role.restaurant.name} can approve imported items before they become dashboard math. Use this for bank,
          accounting, POS, CRM, or PMS records that need a human check.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
            {pending.length} pending
          </span>
          <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
            {role.role.toLowerCase()} view
          </span>
          <Link href="/settings/sources" className="rounded-full border border-copper-dim px-2.5 py-1 text-xs text-copper-soft hover:border-copper">
            Back to source map
          </Link>
        </div>
      </div>

      {pending.length === 0 ? (
        <section className="rounded-lg border border-health-green/30 bg-health-green/5 p-5">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={18} className="mt-0.5 text-health-green" />
            <div>
              <h2 className="text-sm font-medium text-health-green">Nothing needs review right now</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                New imports will appear here when a source record is unmapped, low confidence, or requires approval.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {pending.map((event) => (
            <article key={event.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
                    <span>{event.sourceSystem}</span>
                    <span>{event.sourceObjectType}</span>
                    <span>{event.eventType.replace(/_/g, " ")}</span>
                  </p>
                  <h2 className="mt-1 text-base font-medium text-ink-text">
                    {event.counterparty || event.description || event.sourceObjectId}
                  </h2>
                  {event.description && event.description !== event.counterparty ? (
                    <p className="mt-1 text-sm leading-relaxed text-muted">{event.description}</p>
                  ) : null}
                  {event.issueMessage ? (
                    <p className="mt-3 flex items-start gap-1.5 rounded-md border border-health-yellow/30 bg-health-yellow/5 px-3 py-2 text-xs leading-relaxed text-health-yellow">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {event.issueMessage}
                    </p>
                  ) : null}
                </div>

                <div className="grid min-w-[180px] grid-cols-2 gap-2 text-right">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Amount</p>
                    <p className="tnum mt-1 text-sm text-ink-text">{money(event.amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Confidence</p>
                    <p className="tnum mt-1 text-sm text-ink-text">{confidenceLabel(event.confidence)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted">Date</p>
                    <p className="tnum mt-1 text-sm text-ink-text">{event.eventDate.toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <form action={excludeFinancialEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs text-muted hover:border-health-red hover:text-health-red"
                  >
                    <XCircle size={13} /> Exclude
                  </button>
                </form>
                <form action={approveFinancialEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-3 py-2 text-xs text-copper-soft hover:bg-copper/20"
                  >
                    <CheckCircle2 size={13} /> Approve to ledger
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
