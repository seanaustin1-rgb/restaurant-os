import { auth, clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { landingPathForRole } from "@/lib/access/landing";
import { acceptAccessInvite } from "@/app/settings/access/actions";

function userEmail(user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>): string | null {
  const primaryId = user.primaryEmailAddressId;
  return user.emailAddresses.find((email) => email.id === primaryId)?.emailAddress.toLowerCase() ?? user.emailAddresses[0]?.emailAddress.toLowerCase() ?? null;
}

export default async function AcceptAccessInvitePage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token ?? "";
  const { userId } = await auth();
  const client = await clerkClient();
  const user = userId ? await client.users.getUser(userId) : null;
  const email = user ? userEmail(user) : null;
  const invite = token
    ? await prisma.businessAccessInvite.findUnique({
        where: { token },
        select: {
          token: true,
          email: true,
          role: true,
          status: true,
          restaurant: { select: { name: true } },
        },
      })
    : null;
  const landingPath = invite ? landingPathForRole(invite.role) : "/dashboard";
  const landingLabel = invite?.role === "INVESTOR" ? "Investor Matrix" : invite ? "setup launch" : "dashboard";

  async function accept() {
    "use server";
    await acceptAccessInvite(token);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-10">
      <section className="w-full rounded-lg border border-line bg-surface p-6">
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          <ShieldCheck size={14} /> Access invite
        </p>
        <h1 className="mt-2 font-display text-2xl text-copper-soft">Accept access</h1>

        {!invite && (
          <p className="mt-4 rounded-md border border-health-red/40 bg-health-red/10 px-3 py-2 text-sm text-health-red">
            This invite link is missing or invalid.
          </p>
        )}

        {invite && invite.status !== "PENDING" && (
          <div className="mt-4 rounded-md border border-line bg-ink/40 px-3 py-3 text-sm text-muted">
            This invite is already {invite.status.toLowerCase()}.
          </div>
        )}

        {invite && invite.status === "PENDING" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-line bg-ink/40 px-3 py-3">
              <p className="text-sm text-ink-text">{invite.restaurant.name}</p>
              <p className="mt-1 text-xs text-muted">
                Invited as {invite.role.toLowerCase()} for {invite.email}.
              </p>
              <p className="mt-2 text-xs text-muted">
                After accepting, you will land on the {landingLabel}.
              </p>
            </div>

            {email !== invite.email.toLowerCase() ? (
              <p className="rounded-md border border-health-yellow/40 bg-health-yellow/5 px-3 py-2 text-sm text-health-yellow">
                You are signed in as {email ?? "a different email"}. Sign in with {invite.email} to accept this access.
              </p>
            ) : (
              <form action={accept}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20"
                >
                  <CheckCircle2 size={15} /> Accept access
                </button>
              </form>
            )}
          </div>
        )}

        <Link href={landingPath} className="mt-5 inline-flex text-sm text-copper-soft hover:text-copper">
          Go to {landingLabel}
        </Link>
      </section>
    </main>
  );
}
