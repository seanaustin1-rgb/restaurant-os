CREATE TABLE "BusinessAccessInvite" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAccessInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessAccessInvite_token_key" ON "BusinessAccessInvite"("token");
CREATE INDEX "BusinessAccessInvite_restaurantId_idx" ON "BusinessAccessInvite"("restaurantId");
CREATE INDEX "BusinessAccessInvite_email_idx" ON "BusinessAccessInvite"("email");
CREATE INDEX "BusinessAccessInvite_status_idx" ON "BusinessAccessInvite"("status");

ALTER TABLE "BusinessAccessInvite" ADD CONSTRAINT "BusinessAccessInvite_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
