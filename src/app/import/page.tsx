import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { StatementUploader } from "@/components/import/StatementUploader";

export default async function ImportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Import bank statement</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a statement PDF to backfill transactions. We extract the rows, you review them, then
          they&apos;re categorized and added. Great for loading a few months of history during onboarding.
        </p>
      </div>
      <StatementUploader />
    </main>
  );
}
