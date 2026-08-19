-- Member marketing consent on the guest profile (additive).

-- AlterTable
ALTER TABLE "GuestProfile" ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingOptInAt" TIMESTAMP(3);

