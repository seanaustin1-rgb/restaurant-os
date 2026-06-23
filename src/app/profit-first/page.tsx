import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { ArrowLeft, Landmark, PiggyBank, ShieldCheck, ToggleRight, WalletCards } from "lucide-react";
import { ProfitFirstExplainer } from "@/components/profit-first/ProfitFirstExplainer";

export const metadata: Metadata = {
  title: "Profit First - OutFront Data",
  description: "How OutFront Data uses Profit First to protect owner pay, profit, taxes, and operating cash.",
};

const accounts = [
  "Profit reserve",
  "Owner pay",
  "Tax reserve",
  "Payroll or direct labor",
  "COGS, inventory, or job costs",
  "Operating expenses",
];

export default function ProfitFirstPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-8">
      <Link href="/demo/tour" className="inline-flex items-center gap-2 text-sm text-copper-soft hover:underline">
        <ArrowLeft size={15} />
        Back to demo tour
      </Link>

      <section className="space-y-4">
        <p className="text-[11px] uppercase tracking-[0.24em] text-copper-soft">OutFront Data method</p>
        <h1 className="font-display text-4xl text-[#E6E8E4]">Profit First, in plain English</h1>
        <p className="max-w-3xl text-base leading-relaxed text-muted">
          Most businesses treat profit and owner pay as whatever is left over. Profit First reverses that. A healthy
          business protects profit, owner pay, and taxes first, then runs the company on the remaining operating cash.
          OutFront turns that into a dashboard, a rehearsal, and eventually optional money movement.
        </p>
      </section>

      <ProfitFirstExplainer defaultOpen />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoBlock
          icon={<WalletCards size={18} />}
          title="What the dashboard does"
          body="It reads sales, cash, costs, and categories, then shows whether the business can afford its target set-asides. If the numbers are tight, the dashboard says that before real transfers begin."
        />
        <InfoBlock
          icon={<PiggyBank size={18} />}
          title="What gets protected"
          body="Profit, owner pay, taxes, payroll or direct costs, and normal operating expenses each get their own lane. The exact lanes change by industry, but the discipline is the same."
        />
        <InfoBlock
          icon={<ShieldCheck size={18} />}
          title="Why Go-Live Coach exists"
          body="The coach keeps Profit First virtual until the business is ready. It looks for cash safety, category accuracy, target pressure, and whether the plan would create a shortfall."
        />
        <InfoBlock
          icon={<ToggleRight size={18} />}
          title="How automation turns on"
          body="Real money movement is opt-in. The system can start in observe mode, then a pilot, then a go-live stage where deposits can move into separate accounts that match the plan."
        />
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-start gap-3">
          <Landmark size={19} className="mt-1 shrink-0 text-copper-soft" />
          <div>
            <h2 className="font-display text-xl text-[#E6E8E4]">The separate account idea</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              In a live setup, the owner can use separate bank accounts or sub-accounts so every deposit has a job.
              OutFront does not need to force every transfer on day one. It can show the virtual plan first, then help
              the business graduate toward real transfers when the numbers support it.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {accounts.map((account) => (
                <div key={account} className="rounded-md border border-line bg-[#0B0F0D] px-3 py-2 text-sm text-[#E6E8E4]">
                  {account}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-copper-dim/40 bg-copper/10 p-5">
        <h2 className="font-display text-xl text-[#E6E8E4]">The benefit</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          The owner stops guessing. Taxes stop becoming accidental spending money. Profit is not postponed until some
          perfect future month. The company learns what it can truly afford, and the dashboard gives the owner a clear
          signal when the plan is healthy, stretched, or not ready for real transfers.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/demo/tour" className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
            Tour a sample dashboard
          </Link>
          <Link href="/demo" className="rounded-md border border-line px-4 py-2 text-sm font-medium text-[#E6E8E4] hover:border-copper-dim">
            Try your numbers
          </Link>
        </div>
      </section>
    </main>
  );
}

function InfoBlock({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 text-copper-soft">{icon}</span>
        <div>
          <h2 className="font-display text-lg text-[#E6E8E4]">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        </div>
      </div>
    </section>
  );
}
