-- Speed-to-lead: add login + notification targets to BrokerageAgent so the agent
-- app can resolve "who am I" (clerkUserId) and the alert/dial adapters can target
-- a real recipient (phone for SMS + cell-bridge, pushExternalId for OneSignal).
-- Additive, nullable; migration-gated like the rest of this branch.

ALTER TABLE "BrokerageAgent" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "BrokerageAgent" ADD COLUMN "phone" TEXT;
ALTER TABLE "BrokerageAgent" ADD COLUMN "pushExternalId" TEXT;

CREATE INDEX "BrokerageAgent_clerkUserId_idx" ON "BrokerageAgent"("clerkUserId");
