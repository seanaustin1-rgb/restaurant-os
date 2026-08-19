-- Enforce redemption/code tenant agreement at the DB (P1 hardening):
-- a MembershipRedemption may only reference a MembershipCode in the same restaurant.

-- DropForeignKey
ALTER TABLE "MembershipRedemption" DROP CONSTRAINT "MembershipRedemption_membershipCodeId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCode_id_restaurantId_key" ON "MembershipCode"("id", "restaurantId");

-- AddForeignKey
ALTER TABLE "MembershipRedemption" ADD CONSTRAINT "MembershipRedemption_membershipCodeId_restaurantId_fkey" FOREIGN KEY ("membershipCodeId", "restaurantId") REFERENCES "MembershipCode"("id", "restaurantId") ON DELETE CASCADE ON UPDATE CASCADE;

