import { SignIn } from "@clerk/nextjs";

function teamReturnPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const url = new URL(value, base);
    if (url.origin !== new URL(base).origin || !url.pathname.startsWith("/team/")) return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

export default function SignInPage({ searchParams }: { searchParams: { redirect_url?: string } }) {
  const teamReturn = teamReturnPath(searchParams.redirect_url);
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-8">
      <SignIn forceRedirectUrl={teamReturn} fallbackRedirectUrl="/dashboard" />
    </main>
  );
}
