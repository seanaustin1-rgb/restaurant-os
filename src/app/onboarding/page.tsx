import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

// Protected by Clerk middleware. New users land here after sign-up.
export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-6">
      <OnboardingFlow />
    </main>
  );
}
