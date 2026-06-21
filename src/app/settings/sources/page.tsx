import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PlugZap } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { industryTemplateFor } from "@/lib/industry-templates";
import { sourceMapFor } from "@/lib/source-map";

const ACCESS_ROLES = ["OPERATOR", "CONSULTANT", "MANAGER"] as const;

export default async function SourceMapPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: [...ACCESS_ROLES] } },
    select: { role: true, restaurant: { select: { name: true, businessType: true } } },
  });

  if (!role) redirect("/dashboard");

  const template = industryTemplateFor(role.restaurant.businessType);
  const sourceMap = sourceMapFor(role.restaurant.businessType);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted">Setup</p>
          <h1 className="mt-1 font-display text-2xl text-copper-soft">Source map</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {role.restaurant.name} is using the {template.label.toLowerCase()} template. This map shows the minimum
            automatic inputs and the services that unlock a stronger heartbeat.
          </p>
        </div>
        <span className="rounded-full border border-copper-dim px-3 py-1 text-xs text-copper-soft">
          {role.role.toLowerCase()} view
        </span>
      </div>

      <section className="rounded-lg border border-copper-dim/40 bg-surface p-4">
        <div className="flex items-start gap-2">
          <PlugZap size={18} className="mt-0.5 text-copper-soft" />
          <div>
            <h2 className="text-sm font-medium text-[#E6E8E4]">Minimum auto-input path</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{sourceMap.minimumAutoInput}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sourceMap.groups.map((group) => (
          <section key={group.category + group.label} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-[#E6E8E4]">{group.label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{group.purpose}</p>
              </div>
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                {group.category}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {group.options.map((option) => (
                <div key={option.name} className="rounded-md border border-line bg-ink/40 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-[#E6E8E4]">{option.name}</span>
                    {option.minimum && <span className="text-[10px] uppercase tracking-wider text-copper-soft">minimum</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{option.role}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">Unlocks: {option.unlocks.join(", ")}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
