import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import type { UserRole } from "@prisma/client";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDot,
  Eye,
  Handshake,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { loadOwnerSetupChecklist, type OwnerSetupChecklist, type OwnerSetupStep } from "@/lib/onboarding/setup-checklist";
import { prisma } from "@/lib/prisma";

interface RoleStarter {
  role: UserRole;
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  primary: { label: string; href: string };
  steps: { label: string; href: string; detail: string }[];
}

const STARTERS: RoleStarter[] = [
  {
    role: "OPERATOR",
    eyebrow: "Owner / operator",
    title: "Finish the company setup",
    description: "Confirm the business model, authorize sensitive data sources, then invite the people who should help.",
    icon: ShieldCheck,
    primary: { label: "Open source map", href: "/settings/sources?intro=1" },
    steps: [
      { label: "Confirm template", href: "/settings/business", detail: "Make sure the dashboard matches the industry." },
      { label: "Authorize sources", href: "/settings/sources?intro=1", detail: "Bank, POS, Google, accounting, or booking systems." },
      { label: "Clean vendor mapping", href: "/onboarding/vendors", detail: "Teach the app where recurring spend belongs." },
      { label: "Invite helpers", href: "/settings/access", detail: "Add consultant, accountant, manager, or investor access." },
    ],
  },
  {
    role: "CONSULTANT",
    eyebrow: "Consultant / accountant",
    title: "Prepare the model for the owner",
    description: "Tune the business template and cleanup rules, then ask the owner to authorize sensitive connections.",
    icon: Users,
    primary: { label: "Tune categories", href: "/settings/categories" },
    steps: [
      { label: "Review business template", href: "/settings/business", detail: "Confirm the industry-specific heartbeat." },
      { label: "Plan source map", href: "/settings/sources", detail: "Mark what is connected, planned, blocked, or not needed." },
      { label: "Adjust categories and rules", href: "/settings/categories", detail: "Name dollars so the dashboard can be trusted." },
      { label: "Review exceptions", href: "/transactions/misc", detail: "Clear the biggest unknown transactions first." },
    ],
  },
  {
    role: "MANAGER",
    eyebrow: "Manager",
    title: "Run the daily cleanup lane",
    description: "Watch the heartbeat, handle exceptions, and escalate anything that needs owner approval.",
    icon: Handshake,
    primary: { label: "Open dashboard", href: "/dashboard" },
    steps: [
      { label: "Review dashboard", href: "/dashboard", detail: "Check operating pressure, sales momentum, and cash warnings." },
      { label: "Clear unnamed spend", href: "/transactions/misc", detail: "Fix categories that make the numbers fuzzy." },
      { label: "Confirm vendor setup", href: "/onboarding/vendors", detail: "Keep recurring vendor spend mapped cleanly." },
      { label: "Escalate source issues", href: "/settings/sources", detail: "Flag missing systems for the owner." },
    ],
  },
  {
    role: "INVESTOR",
    eyebrow: "Investor",
    title: "Use the read-only matrix",
    description: "Track business health without touching operating settings, source authorization, or transaction cleanup.",
    icon: Eye,
    primary: { label: "Open investor matrix", href: "/investor" },
    steps: [
      { label: "Review investor matrix", href: "/investor", detail: "Read revenue, cash oxygen, operating pressure, and readiness." },
      { label: "Watch source freshness", href: "/investor", detail: "Know whether the operator's data feed is current." },
      { label: "Ask for missing context", href: "/access", detail: "Understand what your role can and cannot see." },
    ],
  },
];

function priority(role: UserRole): number {
  return ["OPERATOR", "CONSULTANT", "MANAGER", "INVESTOR"].indexOf(role);
}

async function loadRoles(): Promise<{ role: UserRole; restaurantId: string; businessName: string }[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId },
    select: { role: true, restaurantId: true, restaurant: { select: { name: true } } },
    distinct: ["restaurantId"],
  });

  return roles
    .map((row) => ({ role: row.role, restaurantId: row.restaurantId, businessName: row.restaurant.name }))
    .sort((a, b) => priority(a.role) - priority(b.role));
}

// New users land here after sign-up. Existing users get a role-specific launch path.
export default async function OnboardingPage() {
  const roles = await loadRoles();
  if (roles.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink p-6">
        <OnboardingFlow />
      </main>
    );
  }

  const uniqueRoles = [...new Set(roles.map((row) => row.role))];
  const starters = STARTERS.filter((starter) => uniqueRoles.includes(starter.role));
  const businessNames = [...new Set(roles.map((row) => row.businessName))];
  const ownerChecklists = (
    await Promise.all(
      roles
        .filter((row) => row.role === "OPERATOR")
        .map((row) => loadOwnerSetupChecklist(row.restaurantId)),
    )
  ).filter((checklist): checklist is OwnerSetupChecklist => checklist != null);

  return (
    <main className="min-h-screen bg-ink px-4 py-8 text-ink-text sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg border border-copper-dim/40 bg-surface p-5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <SlidersHorizontal size={14} /> Start here
          </p>
          <h1 className="mt-2 font-display text-3xl text-copper-soft">Your next setup move</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            You already have access to {businessNames.join(", ")}. Pick the lane that matches your role and keep moving
            without hunting through the menu.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
              Dashboard <ArrowRight size={15} />
            </Link>
            <Link href="/access" className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-sm text-ink-text hover:border-copper-dim">
              Access paths
            </Link>
          </div>
        </section>

        {ownerChecklists.length > 0 && (
          <section className="space-y-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted">Owner setup checklist</p>
              <h2 className="mt-1 font-display text-2xl text-copper-soft">Finish the setup backbone</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {ownerChecklists.map((checklist) => (
                <OwnerChecklistCard key={checklist.restaurantId} checklist={checklist} />
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {starters.map((starter) => {
            const Icon = starter.icon;
            return (
              <section key={starter.role} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">{starter.eyebrow}</p>
                    <h2 className="mt-1 flex items-center gap-2 font-display text-2xl text-copper-soft">
                      <Icon size={18} /> {starter.title}
                    </h2>
                  </div>
                  <Link href={starter.primary.href} className="shrink-0 rounded-md border border-copper-dim px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
                    {starter.primary.label}
                  </Link>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{starter.description}</p>
                <div className="mt-4 space-y-2">
                  {starter.steps.map((step, index) => (
                    <Link
                      key={step.href}
                      href={step.href}
                      className="flex gap-3 rounded-md border border-line bg-ink/60 px-3 py-3 hover:border-copper-dim"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs text-copper-soft">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block text-sm text-ink-text">{step.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{step.detail}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="rounded-lg border border-line bg-surface p-5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <Banknote size={14} /> New business
          </p>
          <h2 className="mt-1 font-display text-2xl text-copper-soft">Need to add another company?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Use the owner path when you are creating a new business that should have its own dashboard and source map.
          </p>
          <Link href="/access" className="mt-3 inline-flex rounded-md border border-line px-4 py-2 text-sm text-ink-text hover:border-copper-dim">
            Review access paths
          </Link>
        </section>
      </div>
    </main>
  );
}

function OwnerChecklistCard({ checklist }: { checklist: OwnerSetupChecklist }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted">{checklist.businessName}</p>
          <h3 className="mt-1 font-display text-2xl text-copper-soft">{checklist.percent}% setup complete</h3>
          <p className="mt-1 text-sm text-muted">
            {checklist.completed} of {checklist.total} setup steps are complete.
          </p>
        </div>
        <Link href="/settings/sources?intro=1" className="w-fit rounded-md border border-copper-dim px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
          Continue setup
        </Link>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink">
        <div className="h-full rounded-full bg-copper" style={{ width: `${checklist.percent}%` }} />
      </div>
      <div className="mt-4 space-y-2">
        {checklist.steps.map((item) => (
          <OwnerChecklistStep key={item.key} step={item} />
        ))}
      </div>
    </section>
  );
}

function OwnerChecklistStep({ step }: { step: OwnerSetupStep }) {
  const Icon = step.status === "done" ? CheckCircle2 : step.status === "blocked" ? AlertTriangle : CircleDot;
  const tone =
    step.status === "done"
      ? "border-emerald-500/30 text-emerald-200"
      : step.status === "blocked"
        ? "border-orange-500/40 text-orange-200"
        : "border-line text-ink-text";

  return (
    <Link href={step.href} className={`flex gap-3 rounded-md border bg-ink/60 px-3 py-3 hover:border-copper-dim ${tone}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <span>
        <span className="block text-sm">{step.label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{step.detail}</span>
      </span>
    </Link>
  );
}
