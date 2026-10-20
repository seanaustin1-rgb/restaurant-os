import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Investor role is read-only and limited to the curated /investor view
// (CLAUDE.md non-negotiable). Each module page also filters its tenant lookup to
// INTERNAL_VIEW_ROLES, so a mixed-role user never sees a tenant they only invest
// in; this layout additionally sends investor-only users to /investor instead of
// an empty module page. Note: layouts persist across client navigation, so the
// per-page role filter — not this redirect — is the actual data guard.
export default async function ModulesLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const roles = await prisma.userRestaurantRole.findMany({
    where: { clerkUserId: userId },
    select: { role: true },
  });
  if (roles.length > 0 && roles.every((r) => r.role === "INVESTOR")) redirect("/investor");

  return <>{children}</>;
}
