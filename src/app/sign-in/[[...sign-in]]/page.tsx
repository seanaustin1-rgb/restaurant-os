import { SignIn } from "@clerk/nextjs";
import { teamReturnPath } from "@/lib/team/login-return";

export default function SignInPage({ searchParams }: { searchParams: { redirect_url?: string } }) {
  const teamReturn = teamReturnPath(searchParams.redirect_url, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-8">
      <SignIn forceRedirectUrl={teamReturn} fallbackRedirectUrl="/dashboard" />
    </main>
  );
}
