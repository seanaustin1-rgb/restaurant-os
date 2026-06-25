import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Building2, Eye, Handshake, ShieldCheck, Users } from "lucide-react";

const PATHS = [
  {
    title: "Business owner",
    eyebrow: "Default path",
    icon: Building2,
    description: "Create the business, connect the sources, and invite helpers when the company is ready.",
    steps: ["Create business", "Choose template", "Connect bank, POS, accounting, or booking sources", "Invite advisor, manager, or investor later"],
    cta: "Start as owner",
    href: "/onboarding",
  },
  {
    title: "Consultant or accountant",
    eyebrow: "Advisor-led setup",
    icon: Users,
    description: "Prepare a client workspace, pick the right source map, then have the owner claim or approve the setup.",
    steps: ["Set up a client", "Choose industry template", "Plan data sources", "Owner approves sensitive connections"],
    cta: "Plan a client setup",
    href: "/settings/business",
  },
  {
    title: "Investor",
    eyebrow: "Approval-first access",
    icon: Eye,
    description: "Request a heartbeat view after the business owner approves. Investor access should stay limited and clean.",
    steps: ["Request company access", "Owner approves role", "View portfolio-level heartbeat", "No source or settings control by default"],
    cta: "View demo heartbeat",
    href: "/demo/tour",
  },
  {
    title: "Manager",
    eyebrow: "Operator support",
    icon: Handshake,
    description: "Help run the business day-to-day without owning financial setup or investor-level access.",
    steps: ["Review daily metrics", "Handle exceptions", "Support source cleanup", "Escalate cash or labor risks"],
    cta: "Tour manager view",
    href: "/demo/tour",
  },
];

export default function AccessPathsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <section className="rounded-lg border border-copper-dim/40 bg-surface px-5 py-5">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <ShieldCheck size={14} /> Access strategy
        </p>
        <h1 className="mt-2 font-display text-3xl text-copper-soft">Who is setting up the heartbeat?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          The business owns the data. Advisors can help prepare the setup, and investors can request visibility after
          approval. This page is the lightweight role-entry story for demos; full invites and approvals are flagged for a later phase.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <SignUpButton forceRedirectUrl="/onboarding">
            <button className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
              Create a business
            </button>
          </SignUpButton>
          <SignInButton forceRedirectUrl="/dashboard">
            <button className="rounded-md border border-line px-4 py-2 text-sm text-ink-text hover:border-copper-dim">
              Sign in
            </button>
          </SignInButton>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PATHS.map((path) => {
          const Icon = path.icon;
          return (
            <section key={path.title} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{path.eyebrow}</p>
                  <h2 className="mt-1 flex items-center gap-1.5 text-lg font-medium text-ink-text">
                    <Icon size={17} className="text-copper-soft" /> {path.title}
                  </h2>
                </div>
                <Link href={path.href} className="rounded-md border border-line px-3 py-1.5 text-xs text-copper-soft hover:border-copper">
                  {path.cta}
                </Link>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{path.description}</p>
              <div className="mt-3 space-y-1.5">
                {path.steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2 text-xs text-muted">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[10px] text-copper-soft">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
