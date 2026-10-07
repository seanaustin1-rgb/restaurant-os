import { inngest } from "@/lib/inngest/client";
import { TeamDept, TeamLessonType } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireTeamAccess, type TeamViewer } from "./access";
import { teamDb } from "./db";
import { normalizeTeamPhone } from "./phone";

export type NewLessonInput = { restaurantId: string; assetId: string; type: TeamLessonType; title: string;
  takeaway: string; category: string; tags: string[]; audience: TeamDept[]; managersOnly: boolean; publishWhenReady: boolean };
export function cleanLesson(input: NewLessonInput) {
  const title = input.title?.trim(), takeaway = input.takeaway?.trim(), category = input.category?.trim();
  if (!title || title.length > 160 || !takeaway || takeaway.length > 2000 || !category || category.length > 80) throw new Error("Enter a title, takeaway, and category within their limits.");
  if (!Object.values(TeamLessonType).includes(input.type) || !Array.isArray(input.audience) ||
      input.audience.some(dept => !Object.values(TeamDept).includes(dept)) || !Array.isArray(input.tags) ||
      input.tags.length > 20 || input.tags.some(tag => typeof tag !== "string" || tag.length > 40) ||
      typeof input.managersOnly !== "boolean" || typeof input.publishWhenReady !== "boolean") throw new Error("Invalid lesson details.");
  return { type: input.type, title, takeaway, category, audience: [...new Set(input.audience)],
    tags: [...new Set(input.tags.map(tag => tag.trim().toLowerCase()).filter(Boolean))], managersOnly: input.managersOnly };
}
export function publicationDates(type: TeamLessonType, now = new Date()) {
  return { publishedAt: now, feedExpiresAt: type === "SHIFT_BRIEF" ? new Date(now.getTime() + 14 * 86400000) : null };
}
/** Business managers need a membership as the schema's author. Never claim another person's roster row. */
async function authorMembership(viewer: TeamViewer) {
  if (viewer.membershipId) return viewer.membershipId;
  const db = teamDb(viewer.restaurantId);
  const existing = await db.teamMembership.findFirst({ where: { clerkUserId: viewer.clerkUserId, status: "ACTIVE" }, select: { id: true } });
  if (existing) return existing.id;
  const user = await (await clerkClient()).users.getUser(viewer.clerkUserId);
  const phone = user.phoneNumbers.find(row => row.id === user.primaryPhoneNumberId && row.verification?.status === "verified");
  if (!phone) throw new Error("Add and verify your primary phone in your account before creating a lesson.");
  const phoneE164 = normalizeTeamPhone(phone.phoneNumber);
  const row = await db.teamMembership.findUnique({ where: { restaurantId_phoneE164: { restaurantId: viewer.restaurantId, phoneE164 } }, select: { id: true } });
  if (row) throw new Error("Claim your Team roster invitation before creating a lesson.");
  const member = await db.teamMembership.create({ data: { restaurantId: viewer.restaurantId, phoneE164,
    clerkUserId: viewer.clerkUserId, displayName: user.fullName || "Team manager", role: "MEMBER", departments: [], status: "ACTIVE" } });
  await db.teamActionLog.create({ data: { restaurantId: viewer.restaurantId, actorId: viewer.clerkUserId,
    action: "ADD_AUTHOR_MEMBERSHIP", targetType: "TeamMembership", targetId: member.id } });
  return member.id;
}
export async function createTeamLesson(input: NewLessonInput) {
  const viewer = await requireTeamAccess(input.restaurantId, "CONTRIBUTOR");
  const data = cleanLesson(input);
  if (input.publishWhenReady && viewer.role !== "MANAGER") throw new Error("Only a manager can publish.");
  const db = teamDb(input.restaurantId);
  const asset = await db.teamMediaAsset.findFirst({ where: { id: input.assetId }, select: { id: true, status: true } });
  if (!asset || asset.status === "FAILED") throw new Error("Choose a valid uploaded video.");
  const authorId = await authorMembership(viewer);
  const lesson = await db.$transaction(async tx => {
    const row = await tx.teamLesson.create({ data: { restaurantId: input.restaurantId, ...data, authorId,
      mediaAssetId: asset.id, source: "UPLOAD", status: input.publishWhenReady ? "REVIEW" : "DRAFT" }, select: { id: true } });
    await tx.teamActionLog.create({ data: { restaurantId: input.restaurantId, actorId: viewer.membershipId ?? viewer.clerkUserId,
      action: input.publishWhenReady ? "PUBLISH_WHEN_READY" : "CREATE_LESSON", targetType: "TeamLesson", targetId: row.id,
      detail: { clerkUserId: viewer.clerkUserId, managersOnly: data.managersOnly } } });
    return row;
  });
  if (input.publishWhenReady) {
    // The lesson/intent already committed: always return its ID, even if delivery fails.
    // Media-ready retries and status polling can recover the durable intent.
    try {
      await inngest.send({ id: `team-publish-${lesson.id}`, name: "team/lesson.publish.requested", data: { restaurantId: input.restaurantId, assetId: asset.id } });
      await publishQueuedLessons(input.restaurantId, asset.id);
    } catch { console.error("Team publication intent saved; awaiting retry or upload-status recovery."); }
  }
  return lesson.id;
}
/** REVIEW alone is not consent: only an explicit manager intent can publish. */
export async function publishQueuedLessons(restaurantId: string, assetId: string) {
  const db = teamDb(restaurantId);
  const config = await prisma.moduleConfig.findUnique({ where: { restaurantId_moduleKey: { restaurantId, moduleKey: "team_hub" } }, select: { isEnabled: true } });
  if (!config?.isEnabled) return;
  const lessons = await db.teamLesson.findMany({ where: { mediaAssetId: assetId, status: "REVIEW", source: "UPLOAD", mediaAsset: { status: "READY" } }, select: { id: true, type: true } });
  for (const lesson of lessons) {
    const intent = await db.teamActionLog.findFirst({ where: { action: "PUBLISH_WHEN_READY", targetType: "TeamLesson", targetId: lesson.id }, orderBy: { createdAt: "desc" } });
    const detail = intent?.detail as { clerkUserId?: string } | null;
    if (!intent || !detail?.clerkUserId) continue;
    const business = await prisma.userRestaurantRole.findUnique({ where: { clerkUserId_restaurantId: { clerkUserId: detail.clerkUserId, restaurantId } }, select: { role: true } });
    const member = await db.teamMembership.findFirst({ where: { clerkUserId: detail.clerkUserId, status: "ACTIVE", role: "MANAGER" }, select: { id: true } });
    if (business?.role !== "OPERATOR" && business?.role !== "MANAGER" && !member) continue;
    await db.$transaction(async tx => {
      const result = await tx.teamLesson.updateMany({ where: { id: lesson.id, status: "REVIEW", source: "UPLOAD", mediaAsset: { status: "READY" } },
        data: { status: "PUBLISHED", ...publicationDates(lesson.type) } });
      if (result.count) await tx.teamActionLog.create({ data: { restaurantId, actorId: intent.actorId, action: "PUBLISH", targetType: "TeamLesson", targetId: lesson.id,
        detail: { intentId: intent.id } } });
    });
  }
}
export async function publishTeamLesson(restaurantId: string, lessonId: string) {
  const viewer = await requireTeamAccess(restaurantId, "MANAGER");
  const db = teamDb(restaurantId);
  await db.$transaction(async tx => {
    const lesson = await tx.teamLesson.findFirst({ where: { id: lessonId, source: "UPLOAD", status: { in: ["DRAFT", "REVIEW"] }, mediaAsset: { status: "READY" } }, select: { type: true } });
    if (!lesson) throw new Error("This draft is not ready to publish.");
    const result = await tx.teamLesson.updateMany({ where: { id: lessonId, status: { in: ["DRAFT", "REVIEW"] }, mediaAsset: { status: "READY" } },
      data: { status: "PUBLISHED", ...publicationDates(lesson.type) } });
    if (result.count) await tx.teamActionLog.create({ data: { restaurantId, actorId: viewer.membershipId ?? viewer.clerkUserId,
      action: "PUBLISH", targetType: "TeamLesson", targetId: lessonId } });
  });
}
