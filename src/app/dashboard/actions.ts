"use server";

import { auth } from "@clerk/nextjs/server";
import { saveDashboardLayoutForUser } from "@/lib/dashboard/layout-store";

// Persist the signed-in user's dashboard layout (module-grid order + pinned
// Quick Access modules). Called from the client on drag-end / pin-toggle; the UI
// already reflects the change optimistically.
export async function saveDashboardLayout(order: string[], pinned: string[]): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  await saveDashboardLayoutForUser(userId, order, pinned);
}
