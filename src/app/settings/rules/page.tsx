import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RulesManager, type RuleRow, type CategoryOption } from "@/components/rules/RulesManager";

export default async function RulesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "MANAGER"] } },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
  });

  const [rules, cats] = role
    ? await Promise.all([
        prisma.rule.findMany({
          where: { restaurantId: role.restaurantId },
          orderBy: [{ priority: "asc" }, { pattern: "asc" }],
          select: {
            id: true,
            matchType: true,
            pattern: true,
            categoryId: true,
            priority: true,
            enabled: true,
            isSystem: true,
            category: { select: { name: true } },
          },
        }),
        prisma.category.findMany({
          where: { restaurantId: role.restaurantId, archivedAt: null },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  const rows: RuleRow[] = rules
    .map((r) => ({
      id: r.id,
      matchType: r.matchType,
      pattern: r.pattern,
      categoryId: r.categoryId,
      categoryName: r.category?.name ?? "—",
      priority: r.priority,
      enabled: r.enabled,
      isSystem: r.isSystem,
    }))
    // Show rules in the SAME order the engine evaluates them (priority asc, then
    // longer/more-specific pattern, then id) so the top row is the one that runs
    // first — what drag-to-reorder lets the operator control. Mirrors sortRules().
    .sort((a, b) => a.priority - b.priority || b.pattern.length - a.pattern.length || (a.id < b.id ? -1 : 1));
  const categories: CategoryOption[] = cats.map((c) => ({ id: c.id, name: c.name }));

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Categorization Rules</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your restaurant"} — rules tag imported transactions automatically. Add a keyword
          (e.g. <span className="text-[#E6E8E4]">MAILCHIMP → Marketing</span>) and future imports self-categorize. Lower
          priority runs first; your rules win over the built-in vendor list. Manual edits on a transaction always stick.
        </p>
      </div>
      {role ? (
        <RulesManager rows={rows} categories={categories} />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need an operator/manager role on a restaurant to manage rules.
        </p>
      )}
    </main>
  );
}
