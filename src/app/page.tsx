import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

// Signed-in users never need the marketing landing; send them straight to the
// dashboard. Doing it here server-side makes the post-login destination reliable
// even if Clerk's redirect env vars are not set in the deployment.
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="OutFront Data" className="h-16 w-auto" />
      <p className="text-muted">Know your numbers. Decide now.</p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <SignInButton forceRedirectUrl="/dashboard">
          <button className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-text hover:border-copper-dim">
            Log in
          </button>
        </SignInButton>
        <Link
          href="/demo/tour"
          className="rounded-md bg-copper px-4 py-2 text-sm font-medium text-ink hover:bg-copper-soft"
        >
          Take a tour
        </Link>
      </div>

      <footer className="mt-4">
        <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
