import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

// Signed-in users never need the marketing landing — send them straight to the
// dashboard. Doing it here (server-side) makes the post-login destination
// reliable even if Clerk's redirect env vars aren't set in the deployment.
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="OutFront Data" className="h-16 w-auto" />
      <p className="text-muted">Know your numbers. Decide now.</p>

      <div className="flex items-center gap-4">
        <SignInButton forceRedirectUrl="/dashboard">
          <button className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-[#E6E8E4] hover:border-copper-dim">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton forceRedirectUrl="/onboarding">
          <button className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft">
            Sign up
          </button>
        </SignUpButton>
      </div>

      <p className="text-sm text-muted">
        Curious first?{" "}
        <Link href="/demo" className="text-copper-soft hover:text-copper">See your numbers</Link>
        <span className="text-line"> · </span>
        <Link href="/demo/tour" className="text-copper-soft hover:text-copper">Tour a live demo</Link>
        <span className="text-line"> Â· </span>
        <Link href="/access" className="text-copper-soft hover:text-copper">Choose access path</Link>
      </p>

      <footer className="mt-4">
        <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
