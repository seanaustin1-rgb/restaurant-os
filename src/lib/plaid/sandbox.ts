import { Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

// "First Platypus Bank" — the default Plaid sandbox institution.
const SANDBOX_INSTITUTION_ID = "ins_109508";

export interface SandboxConnectionResult {
  restaurantId: string;
  plaidConnectionId: string;
  itemId: string;
  institution: string;
}

/**
 * Dev helper: spin up a Plaid sandbox bank link and store it as a PlaidConnection.
 * If no restaurantId is given, attaches to the first restaurant (creating a bare
 * one if none exist yet), so it works even before onboarding.
 */
export async function createSandboxConnection(restaurantId?: string): Promise<SandboxConnectionResult> {
  let rid = restaurantId;
  if (!rid) {
    const existing = await prisma.restaurant.findFirst({ orderBy: { createdAt: "asc" } });
    rid = existing?.id;
  }
  if (!rid) {
    const created = await prisma.restaurant.create({
      data: {
        name: "Sandbox Diner",
        slug: `sandbox-${Math.random().toString(36).slice(2, 8)}`,
        tapSettings: { create: {} },
      },
    });
    rid = created.id;
  }

  // 1. Create a sandbox public token, then exchange it for an access token.
  const pub = await plaidClient.sandboxPublicTokenCreate({
    institution_id: SANDBOX_INSTITUTION_ID,
    initial_products: [Products.Transactions],
  });
  const exchange = await plaidClient.itemPublicTokenExchange({
    public_token: pub.data.public_token,
  });

  const institution = "First Platypus Bank (Sandbox)";

  // 2. Store the connection with the access token encrypted at rest.
  const connection = await prisma.plaidConnection.create({
    data: {
      restaurantId: rid,
      itemId: exchange.data.item_id,
      accessToken: encrypt(exchange.data.access_token),
      institution,
      isActive: true,
    },
  });

  return {
    restaurantId: rid,
    plaidConnectionId: connection.id,
    itemId: exchange.data.item_id,
    institution,
  };
}
