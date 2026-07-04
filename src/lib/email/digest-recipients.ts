import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// Resolve who receives a restaurant's Daily Digest. Recipients are the OPERATOR
// role-holders; their email lives in Clerk (not the DB), so we resolve each
// clerkUserId to its primary email — mirroring settings/access/actions.ts. A user
// deleted in Clerk is skipped rather than failing the whole send.
export async function digestRecipientEmails(restaurantId: string): Promise<string[]> {
  const roles = await prisma.userRestaurantRole.findMany({
    where: { restaurantId, role: "OPERATOR" },
    select: { clerkUserId: true },
  });
  if (roles.length === 0) return [];

  const client = await clerkClient();
  const emails: string[] = [];
  for (const { clerkUserId } of roles) {
    try {
      const user = await client.users.getUser(clerkUserId);
      const primaryId = user.primaryEmailAddressId;
      const email =
        user.emailAddresses.find((e) => e.id === primaryId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress;
      if (email) emails.push(email.toLowerCase());
    } catch {
      // clerkUserId no longer resolves (user removed) — skip this recipient.
    }
  }
  return [...new Set(emails)];
}
