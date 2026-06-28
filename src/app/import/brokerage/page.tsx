import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BrokerageImportPilot } from "@/components/import/BrokerageImportPilot";

export default async function BrokerageImportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Import brokerage data</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Paste a brokerage export to preview agents, closed and pending deals, and lead spend
          before anything is saved. Company Dollar is derived from GCI minus agent splits,
          franchise, and referral fees when the export does not already carry it. Supports a
          back-office JSON payload (Brokermint / Sisu / BoldTrail-shaped), or paste a CSV export
          and convert it with the built-in column mapper.
        </p>
      </div>
      <BrokerageImportPilot />
    </main>
  );
}
