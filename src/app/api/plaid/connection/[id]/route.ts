import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

// Removes a Plaid connection: revokes the Item at Plaid, deletes the
// transactions that came from it, then deletes the connection row. Used when an
// operator wants to disconnect a bank (e.g. to re-link and pick only the right
// account via Account Select).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // The user must own the restaurant this connection belongs to.
  const role = await prisma.userRestaurantRole.findFirst({
    where: { clerkUserId: userId, role: "OPERATOR" },
    select: { restaurantId: true },
  });
  if (!role) {
    return NextResponse.json({ error: "no restaurant for user" }, { status: 400 });
  }

  const connection = await prisma.plaidConnection.findFirst({
    where: { id, restaurantId: role.restaurantId },
    select: { id: true, accessToken: true },
  });
  if (!connection) {
    return NextResponse.json({ error: "connection not found" }, { status: 404 });
  }

  // Best-effort: revoke the access token at Plaid. If this fails (token already
  // invalid, network blip) we still clean up locally so the UI doesn't get stuck.
  try {
    await plaidClient.itemRemove({ access_token: decrypt(connection.accessToken) });
  } catch {
    /* non-fatal — continue with local cleanup */
  }

  // Remove the transactions this connection pulled in, then the connection.
  const { count } = await prisma.transaction.deleteMany({
    where: { plaidConnectionId: connection.id },
  });
  await prisma.plaidConnection.delete({ where: { id: connection.id } });

  return NextResponse.json({ removed: true, transactionsDeleted: count });
}
