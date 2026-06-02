-- DropIndex
DROP INDEX "VirtualAccount_restaurantId_bucket_key";

-- AlterTable (VirtualAccount is empty in dev; safe to drop the enum column and add key)
ALTER TABLE "VirtualAccount" DROP COLUMN "bucket",
ADD COLUMN     "key" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_restaurantId_key_key" ON "VirtualAccount"("restaurantId", "key");
