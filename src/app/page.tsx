import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

// Signed-in users never need the marketing landing — send them straight to the
// dashboard. Doing it here (server-side) makes the post-login destination
// reliable even if Clerk's redirect env vars aren't set in the deployment.
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-display text-5xl font-semibold text-copper-soft">Restaurant OS</h1>
      <p className="text-muted">Multi-tenant restaurant operator intelligence platform.</p>

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
    </main>
  );
}
