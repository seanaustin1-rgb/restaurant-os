import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BusinessTemplateForm } from "@/components/business/BusinessTemplateForm";

export default async function BusinessSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: { in: ["OPERATOR", "CONSULTANT", "MANAGER"] } },
    select: { restaurantId: true, role: true, restaurant: { select: { name: true, businessType: true, seatCount: true, profile: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl text-copper-soft">Business Template</h1>
        <p className="mt-1 text-sm text-muted">
          {role?.restaurant?.name ?? "Your client"} - choose the heartbeat shape and recommended module set for this
          business. Owners and advisors can update this as the setup gets clearer.
        </p>
      </div>

      {role ? (
        <BusinessTemplateForm
          initialBusinessType={role.restaurant.businessType}
          initialProfile={role.restaurant.profile}
          initialSeatCount={role.restaurant.seatCount}
          actorRole={role.role}
        />
      ) : (
        <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          You need an owner, consultant, or manager role on a restaurant to manage its business template.
        </p>
      )}
    </main>
  );
}
