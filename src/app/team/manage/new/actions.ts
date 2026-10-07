"use server";
import { revalidatePath } from "next/cache";
import { requireTeamAccess } from "@/lib/team/access";
import { teamDb } from "@/lib/team/db";
import { createTeamLesson, publishTeamLesson, publishQueuedLessons, type NewLessonInput } from "@/lib/team/lessons";
export async function saveLesson(input: NewLessonInput) {
  const id = await createTeamLesson(input);
  revalidatePath("/team");
  revalidatePath("/team/manage/new");
  return id;
}
export async function publishLesson(restaurantId: string, lessonId: string) {
  await publishTeamLesson(restaurantId, lessonId);
  revalidatePath("/team");
  revalidatePath("/team/manage/new");
}
export async function lessonUploadStatus(restaurantId: string, assetId: string, lessonId?: string) {
  const viewer = await requireTeamAccess(restaurantId, "CONTRIBUTOR");
  const db = teamDb(restaurantId);
  const asset = await db.teamMediaAsset.findFirst({ where: { id: assetId }, select: { status: true, hasCaptions: true } });
  if (!asset) throw new Error("Upload not found.");
  if (asset.status === "READY") await publishQueuedLessons(restaurantId, assetId);
  const lesson = lessonId ? await db.teamLesson.findFirst({
    where: { id: lessonId, mediaAssetId: assetId, ...(viewer.role === "MANAGER" ? {} : { authorId: viewer.membershipId ?? "" }) },
    select: { status: true },
  }) : null;
  return { ...asset, lessonStatus: lesson?.status ?? null };
}

/** Draft management is role/author guarded; public lesson reads use visibleLessonFilter. */
export async function loadLessonDrafts(restaurantId: string) {
  const viewer = await requireTeamAccess(restaurantId, "CONTRIBUTOR");
  return teamDb(restaurantId).teamLesson.findMany({
    where: { status: { in: ["DRAFT", "REVIEW"] }, source: "UPLOAD",
      ...(viewer.role === "MANAGER" ? {} : { authorId: viewer.membershipId ?? "" }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    select: { id: true, title: true, takeaway: true, category: true, audience: true, managersOnly: true, status: true,
      mediaAsset: { select: { status: true } } },
  });
}