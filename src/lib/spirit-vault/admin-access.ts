import type { Prisma } from "@prisma/client";
import { OPERATOR_ROLES } from "@/lib/access/roles";

export function configuredSpiritVaultRestaurantId(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.SPIRIT_VAULT_RESTAURANT_ID?.trim();
  return value ? value : null;
}

export function vaultOperatorRoleWhere(
  clerkUserId: string,
  restaurantId = configuredSpiritVaultRestaurantId(),
): Prisma.UserRestaurantRoleWhereInput {
  return {
    clerkUserId,
    role: { in: [...OPERATOR_ROLES] },
    restaurant: {
      businessType: "RESTAURANT",
      ...(restaurantId ? { id: restaurantId } : {}),
    },
  };
}
