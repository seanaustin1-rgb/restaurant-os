import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RentalImportPilot } from "@/components/import/RentalImportPilot";
import { SourceProfileCards } from "@/components/sources/SourceProfileCards";

export default async function RentalImportPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const roles = await prisma.userRestaurantRole.findMany({
    where: {
      clerkUserId: userId,
      role: { in: ["OPERATOR", "MANAGER", "CONSULTANT"] },
      restaurant: { businessType: "VACATION_RENTAL" },
    },
    select: { restaurantId: true, restaurant: { select: { name: true } } },
    orderBy: { restaurant: { name: "asc" } },
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-copper-soft">Import rental data</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Paste a rental export to preview properties, bookings, owner statements, expenses,
            maintenance issues, and reviews before anything is saved. This pilot import supports
            Escapia-like payloads and CSV-shaped data after it has been mapped to JSON.
          </p>
        </div>
        <Link href="/import/rentals/history" className="text-sm text-copper-soft hover:underline">
          View import history
        </Link>
      </div>
      <SourceProfileCards ids={["escapia-operations", "escapia-owner-statements"]} />
      <RentalImportPilot businesses={roles.map((role) => ({ id: role.restaurantId, name: role.restaurant.name }))} />
    </main>
  );
}
