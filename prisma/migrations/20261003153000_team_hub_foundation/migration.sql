-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('MEMBER', 'CONTRIBUTOR', 'MANAGER');

-- CreateEnum
CREATE TYPE "TeamDept" AS ENUM ('FOH', 'BOH', 'BAR', 'BAKERY', 'MGMT');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "TeamLessonType" AS ENUM ('SHIFT_BRIEF', 'HOSPITALITY', 'PRODUCT', 'UPDATE', 'MOMENT');

-- CreateEnum
CREATE TYPE "TeamLessonStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeamLessonSource" AS ENUM ('UPLOAD', 'IMPORT', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "TeamMediaStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TeamMomentStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',
    "departments" "TeamDept"[],
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'INVITED',
    "lastFeedSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMediaAsset" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'CLOUDFLARE_STREAM',
    "providerAssetId" TEXT NOT NULL,
    "status" "TeamMediaStatus" NOT NULL DEFAULT 'UPLOADING',
    "durationSec" INTEGER,
    "hasCaptions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLesson" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "TeamLessonType" NOT NULL,
    "title" TEXT NOT NULL,
    "takeaway" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "audience" "TeamDept"[],
    "managersOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" "TeamLessonStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "TeamLessonSource" NOT NULL DEFAULT 'UPLOAD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "mediaAssetId" TEXT,
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "feedExpiresAt" TIMESTAMP(3),
    "checkPrompt" TEXT,
    "checkOptions" JSONB,
    "checkAnswer" INTEGER,
    "productRef" TEXT,
    "importKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamModule" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audience" "TeamDept"[],
    "managersOnly" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamModuleItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "requiresDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamModuleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAssignment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamLessonProgress" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "lessonVersion" INTEGER NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watchedAt" TIMESTAMP(3),
    "understoodAt" TIMESTAMP(3),
    "demonstratedAt" TIMESTAMP(3),
    "demonstratedById" TEXT,

    CONSTRAINT "TeamLessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMoment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "whyItMattered" TEXT NOT NULL,
    "tryThisShift" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "status" "TeamMomentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "publishedLessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamActionLog" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMembership_clerkUserId_status_idx" ON "TeamMembership"("clerkUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_restaurantId_phoneE164_key" ON "TeamMembership"("restaurantId", "phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_restaurantId_clerkUserId_key" ON "TeamMembership"("restaurantId", "clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_id_restaurantId_key" ON "TeamMembership"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamMediaAsset_restaurantId_idx" ON "TeamMediaAsset"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMediaAsset_provider_providerAssetId_key" ON "TeamMediaAsset"("provider", "providerAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMediaAsset_id_restaurantId_key" ON "TeamMediaAsset"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamLesson_restaurantId_status_publishedAt_idx" ON "TeamLesson"("restaurantId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "TeamLesson_mediaAssetId_restaurantId_idx" ON "TeamLesson"("mediaAssetId", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamLesson_authorId_restaurantId_idx" ON "TeamLesson"("authorId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamLesson_restaurantId_importKey_key" ON "TeamLesson"("restaurantId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "TeamLesson_id_restaurantId_key" ON "TeamLesson"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamModule_restaurantId_idx" ON "TeamModule"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamModule_id_restaurantId_key" ON "TeamModule"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamModuleItem_restaurantId_idx" ON "TeamModuleItem"("restaurantId");

-- CreateIndex
CREATE INDEX "TeamModuleItem_lessonId_restaurantId_idx" ON "TeamModuleItem"("lessonId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamModuleItem_moduleId_position_key" ON "TeamModuleItem"("moduleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TeamModuleItem_moduleId_lessonId_key" ON "TeamModuleItem"("moduleId", "lessonId");

-- CreateIndex
CREATE INDEX "TeamAssignment_restaurantId_idx" ON "TeamAssignment"("restaurantId");

-- CreateIndex
CREATE INDEX "TeamAssignment_membershipId_restaurantId_idx" ON "TeamAssignment"("membershipId", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamAssignment_assignedById_restaurantId_idx" ON "TeamAssignment"("assignedById", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAssignment_moduleId_membershipId_key" ON "TeamAssignment"("moduleId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAssignment_id_restaurantId_key" ON "TeamAssignment"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamLessonProgress_restaurantId_idx" ON "TeamLessonProgress"("restaurantId");

-- CreateIndex
CREATE INDEX "TeamLessonProgress_lessonId_restaurantId_idx" ON "TeamLessonProgress"("lessonId", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamLessonProgress_demonstratedById_restaurantId_idx" ON "TeamLessonProgress"("demonstratedById", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamLessonProgress_membershipId_lessonId_key" ON "TeamLessonProgress"("membershipId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamLessonProgress_id_restaurantId_key" ON "TeamLessonProgress"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamMoment_restaurantId_status_idx" ON "TeamMoment"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "TeamMoment_submittedById_restaurantId_idx" ON "TeamMoment"("submittedById", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamMoment_mediaAssetId_restaurantId_idx" ON "TeamMoment"("mediaAssetId", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamMoment_reviewedById_restaurantId_idx" ON "TeamMoment"("reviewedById", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamMoment_publishedLessonId_restaurantId_idx" ON "TeamMoment"("publishedLessonId", "restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMoment_id_restaurantId_key" ON "TeamMoment"("id", "restaurantId");

-- CreateIndex
CREATE INDEX "TeamActionLog_restaurantId_createdAt_idx" ON "TeamActionLog"("restaurantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamActionLog_id_restaurantId_key" ON "TeamActionLog"("id", "restaurantId");

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMediaAsset" ADD CONSTRAINT "TeamMediaAsset_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLesson" ADD CONSTRAINT "TeamLesson_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLesson" ADD CONSTRAINT "TeamLesson_mediaAssetId_restaurantId_fkey" FOREIGN KEY ("mediaAssetId", "restaurantId") REFERENCES "TeamMediaAsset"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLesson" ADD CONSTRAINT "TeamLesson_authorId_restaurantId_fkey" FOREIGN KEY ("authorId", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamModule" ADD CONSTRAINT "TeamModule_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamModuleItem" ADD CONSTRAINT "TeamModuleItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamModuleItem" ADD CONSTRAINT "TeamModuleItem_moduleId_restaurantId_fkey" FOREIGN KEY ("moduleId", "restaurantId") REFERENCES "TeamModule"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamModuleItem" ADD CONSTRAINT "TeamModuleItem_lessonId_restaurantId_fkey" FOREIGN KEY ("lessonId", "restaurantId") REFERENCES "TeamLesson"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_moduleId_restaurantId_fkey" FOREIGN KEY ("moduleId", "restaurantId") REFERENCES "TeamModule"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_membershipId_restaurantId_fkey" FOREIGN KEY ("membershipId", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAssignment" ADD CONSTRAINT "TeamAssignment_assignedById_restaurantId_fkey" FOREIGN KEY ("assignedById", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLessonProgress" ADD CONSTRAINT "TeamLessonProgress_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLessonProgress" ADD CONSTRAINT "TeamLessonProgress_membershipId_restaurantId_fkey" FOREIGN KEY ("membershipId", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLessonProgress" ADD CONSTRAINT "TeamLessonProgress_lessonId_restaurantId_fkey" FOREIGN KEY ("lessonId", "restaurantId") REFERENCES "TeamLesson"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLessonProgress" ADD CONSTRAINT "TeamLessonProgress_demonstratedById_restaurantId_fkey" FOREIGN KEY ("demonstratedById", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMoment" ADD CONSTRAINT "TeamMoment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMoment" ADD CONSTRAINT "TeamMoment_submittedById_restaurantId_fkey" FOREIGN KEY ("submittedById", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMoment" ADD CONSTRAINT "TeamMoment_mediaAssetId_restaurantId_fkey" FOREIGN KEY ("mediaAssetId", "restaurantId") REFERENCES "TeamMediaAsset"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMoment" ADD CONSTRAINT "TeamMoment_reviewedById_restaurantId_fkey" FOREIGN KEY ("reviewedById", "restaurantId") REFERENCES "TeamMembership"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMoment" ADD CONSTRAINT "TeamMoment_publishedLessonId_restaurantId_fkey" FOREIGN KEY ("publishedLessonId", "restaurantId") REFERENCES "TeamLesson"("id", "restaurantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActionLog" ADD CONSTRAINT "TeamActionLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
