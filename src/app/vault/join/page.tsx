import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignIn } from "@clerk/nextjs";
import { getMembershipStatus } from "@/app/vault/actions";
import { RedeemMembershipForm } from "@/components/spirit-vault/RedeemMembershipForm";

// Member sign-in + code redemption. Public page (guests must reach it signed-out);
// the redeem action itself is auth-gated.
export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default async function JoinPage() {
  const { userId } = await auth();
  const status = await getMembershipStatus();

  return (
    <main className="mx-auto min-h-screen max-w-md bg-ink px-5 py-12 text-ink-text">
      <header className="text-center">
        <p className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.28em] text-copper-soft">Echo&apos;s Reserve</p>
        <h1 className="mt-2 font-display text-3xl text-copper-soft">Members</h1>
      </header>

      {status.isMember && status.currentPeriodEnd ? (
        <div className="mt-8 rounded-xl border border-copper-dim bg-copper/10 p-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-copper-soft">Member ✓</p>
          <p className="mt-2 text-sm text-ink-text-soft">
            Full vault access through <span className="font-semibold text-ink-text">{fmt(status.currentPeriodEnd)}</span>.
          </p>
          <Link href="/vault" className="mt-5 inline-block rounded-md bg-copper px-5 py-2.5 font-mono text-sm text-ink">
            Enter the Vault
          </Link>
        </div>
      ) : !userId ? (
        <div className="mt-8">
          <p className="text-center text-sm text-ink-text-soft">
            Sign in with your email to redeem your membership. We&apos;ll send a one-time link — no password to remember.
          </p>
          <div className="mt-6 flex justify-center">
            <SignIn routing="hash" forceRedirectUrl="/vault/join" signUpForceRedirectUrl="/vault/join" />
          </div>
        </div>
      ) : (
        <>
          <p className="mt-6 text-center text-sm text-ink-text-soft">Welcome back — enter your membership code to unlock the vault for the year.</p>
          <RedeemMembershipForm />
        </>
      )}

      <p className="mt-10 text-center text-xs text-muted">
        Not a member yet? Ask at the bar — or scan tonight&apos;s code to explore the vault today.
      </p>
    </main>
  );
}
