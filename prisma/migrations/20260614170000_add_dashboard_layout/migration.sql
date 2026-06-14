-- Per-user dashboard module ordering (drag-and-drop layout, saved to the
-- account so it follows the login across devices). Distinct from ModuleConfig,
-- which is per-restaurant.
CREATE TABLE "DashboardLayout" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "moduleOrder" JSONB NOT NULL,
    "pinnedModules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardLayout_clerkUserId_key" ON "DashboardLayout"("clerkUserId");
