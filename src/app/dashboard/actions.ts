"use server";

import { auth } from "@clerk/nextjs/server";
import { saveModuleOrderForUser } from "@/lib/dashboard/layout-store";

// Persist the signed-in user's dashboard module order. Called from the grid on
// drag-end; the client already reflects the new order optimistically.
export async function saveModuleOrder(order: string[]): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  await saveModuleOrderForUser(userId, order);
}
