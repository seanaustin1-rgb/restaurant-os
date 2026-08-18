-- Spirit Vault guest membership layer: account-based access via hashed,
-- server-verified, revocable, auditable membership codes. Additive only.

-- CreateEnum
CREATE TYPE "MembershipCodeStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "GuestMembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "GuestProfile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipCode" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'echo_reserve',
    "grantDays" INTEGER NOT NULL DEFAULT 365,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MembershipCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByClerkUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRedemption" (
    "id" TEXT NOT NULL,
    "membershipCodeId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "membershipId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestMembership" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'echo_reserve',
    "status" "GuestMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL DEFAULT 'code',
    "clerkSubscriptionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestProfile_clerkUserId_key" ON "GuestProfile"("clerkUserId");

-- CreateIndex
CREATE INDEX "GuestProfile_email_idx" ON "GuestProfile"("email");

-- CreateIndex
CREATE INDEX "MembershipCode_restaurantId_status_idx" ON "MembershipCode"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipCode_restaurantId_codeHash_key" ON "MembershipCode"("restaurantId", "codeHash");

-- CreateIndex
CREATE INDEX "MembershipRedemption_restaurantId_redeemedAt_idx" ON "MembershipRedemption"("restaurantId", "redeemedAt");

-- CreateIndex
CREATE INDEX "MembershipRedemption_guestId_idx" ON "MembershipRedemption"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipRedemption_membershipCodeId_guestId_key" ON "MembershipRedemption"("membershipCodeId", "guestId");

-- CreateIndex
CREATE INDEX "GuestMembership_guestId_restaurantId_status_idx" ON "GuestMembership"("guestId", "restaurantId", "status");

-- CreateIndex
CREATE INDEX "GuestMembership_restaurantId_currentPeriodEnd_idx" ON "GuestMembership"("restaurantId", "currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "MembershipCode" ADD CONSTRAINT "MembershipCode_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRedemption" ADD CONSTRAINT "MembershipRedemption_membershipCodeId_fkey" FOREIGN KEY ("membershipCodeId") REFERENCES "MembershipCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRedemption" ADD CONSTRAINT "MembershipRedemption_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMembership" ADD CONSTRAINT "GuestMembership_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestMembership" ADD CONSTRAINT "GuestMembership_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Guardrails Prisma's schema DSL can't express:
ALTER TABLE "MembershipCode" ADD CONSTRAINT "MembershipCode_grantDays_check" CHECK ("grantDays" > 0);
ALTER TABLE "MembershipCode" ADD CONSTRAINT "MembershipCode_redemptionCount_check" CHECK ("redemptionCount" >= 0);
ALTER TABLE "MembershipCode" ADD CONSTRAINT "MembershipCode_maxRedemptions_check" CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" > 0);
