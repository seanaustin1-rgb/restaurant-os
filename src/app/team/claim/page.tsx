import Link from "next/link";
import { redirect } from "next/navigation";
import { claimTeamMembership, TeamClaimDenied } from "@/lib/team/claim";

export const dynamic = "force-dynamic";

export default async function ClaimTeamPage({ searchParams }: { searchParams: { restaurantId?: string } }) {
  const restaurantId = searchParams.restaurantId ?? "";
  try {
    await claimTeamMembership(restaurantId);
  } catch (error) {
    if (!(error instanceof TeamClaimDenied)) throw error;
    return (
      <main className="mx-auto max-w-xl space-y-4 px-5 py-12">
        <h1 className="font-display text-3xl">Team invitation</h1>
        <p className="text-sm text-muted">{error.message} Ask your manager to check the phone on your roster entry, then sign in with that number.</p>
        <Link href="/team" className="text-copper-soft underline">Open Team Hub</Link>
      </main>
    );
  }
  redirect(`/team?restaurantId=${encodeURIComponent(restaurantId)}`);
}
