import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Database, Info } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { groupPendingBySignature, loadPendingFinancialEvents } from "@/lib/financial-ledger/review";
import { loadRules, applyRules } from "@/lib/categorization/rules";
import { RowActions, BulkGroupForm, type CategoryOption } from "./ReviewControls";
import { BULK_CONFIRM_THRESHOLD } from "./constants";

const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function confidenceLabel(value: number) {
  if (value <= 0) return "unmapped";
  return `${Math.round(value * 100)}%`;
}

export default async function FinancialMappingReviewPage({
  searchParams,
}: {
  searchParams?: { notice?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { restaurantId: true, role: true, restaurant: { select: { name: true } } },
  });
  if (!role) redirect("/dashboard");

  const pending = await loadPendingFinancialEvents(prisma, role.restaurantId, 25);
  const groupedPending = await loadPendingFinancialEvents(prisma, role.restaurantId, 500);
  const groups = groupPendingBySignature(groupedPending).slice(0, 5);

  // Category options + the rule engine's current guess per row (the re-type default).
  const [categoryRows, rules] = await Promise.all([
    prisma.category.findMany({
      where: { restaurantId: role.restaurantId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    loadRules(prisma, role.restaurantId),
  ]);
  const categories: CategoryOption[] = categoryRows.map((c) => ({ id: c.id, name: c.name }));
  const validCategoryIds = new Set(categories.map((c) => c.id));
  const guessFor = (counterparty: string | null, description: string | null): string | null => {
    const match = applyRules(rules, counterparty, description);
    return match && validCategoryIds.has(match.categoryId) ? match.categoryId : null;
  };
  const guessByEventId = new Map(groupedPending.map((e) => [e.id, guessFor(e.counterparty, e.description)]));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-lg border border-copper-dim/40 bg-surface p-5">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <Database size={14} /> Clean ledger review
        </p>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Financial Mapping Review</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          {role.restaurant.name} can approve imported items before they become dashboard math. Re-type a
          category inline, save the fix as a vendor rule, or clear a whole vendor group at once.
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

      {searchParams?.notice ? (
        <p className="flex items-start gap-2 rounded-lg border border-copper-dim/40 bg-copper/5 px-4 py-3 text-xs leading-relaxed text-copper-soft">
          <Info size={14} className="mt-0.5 shrink-0" />
          {searchParams.notice}
        </p>
      ) : null}

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
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">Clear by pattern</p>
                <h2 className="mt-1 text-base font-medium text-ink-text">Largest vendor groups</h2>
              </div>
              <p className="max-w-md text-xs leading-relaxed text-muted">
                Pick a category and approve or exclude the whole group. Groups over {BULK_CONFIRM_THRESHOLD} rows ask
                you to confirm first. Clearing the top groups usually clears most of the noise.
              </p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {groups.map((group) => (
                <div key={group.key} className="rounded-md border border-line/80 bg-ink/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-text">{group.sampleLabel}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-muted">{group.sourceSystem}</p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-sm text-copper-soft">{group.count}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted">items</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{group.issueLabel}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="tnum text-muted">{money(group.totalAmount)}</span>
                    <span className="tnum text-muted">{group.latestEventDate.toLocaleDateString()}</span>
                  </div>
                  <BulkGroupForm
                    eventIds={group.eventIds}
                    count={group.count}
                    categories={categories}
                    defaultCategoryId={guessByEventId.get(group.eventIds[0]) ?? null}
                    confirmThreshold={BULK_CONFIRM_THRESHOLD}
                  />
                </div>
              ))}
            </div>
          </div>

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

              <RowActions
                eventId={event.id}
                categories={categories}
                defaultCategoryId={guessByEventId.get(event.id) ?? null}
              />
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
