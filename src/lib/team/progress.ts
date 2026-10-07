import { Prisma } from "@prisma/client";
import { requireTeamAccess, visibleLessonFilter } from "./access";
import { teamDb } from "./db";
import { teamTrackingMembership } from "./tracking";

export function mergePlayedRanges(ranges: [number, number][], duration: number): [number, number][] {
  if (!Array.isArray(ranges) || !Number.isFinite(duration) || duration <= 0) throw new Error("Invalid playback");
  const sorted = ranges.map(range => {
    if (!Array.isArray(range) || range.length !== 2 || range.some(n => typeof n !== "number" || !Number.isFinite(n)) ||
        range[0] < 0 || range[1] < range[0] || range[1] > duration + 1) throw new Error("Invalid played range");
    return [range[0], Math.min(range[1], duration)] as [number, number];
  }).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else if (end > start) merged.push([start, end]);
  }
  return merged;
}
/** Union actual played ranges, so replaying or seeking cannot inflate coverage. */
export function playedSeconds(ranges: [number, number][], duration: number): number {
  return mergePlayedRanges(ranges, duration).reduce((total, [start, end]) => total + end - start, 0);
}
export async function recordTeamProgress(input: { restaurantId: string; lessonId: string; version: number; ranges: [number, number][] }) {
  const viewer = await requireTeamAccess(input.restaurantId);
  const db = teamDb(input.restaurantId);
  const lesson = await db.teamLesson.findFirst({
    where: { id: input.lessonId, ...visibleLessonFilter(viewer) },
    select: { version: true, mediaAsset: { select: { durationSec: true, status: true } } },
  });
  if (!lesson) return "not-found";
  if (lesson.version !== input.version || lesson.mediaAsset?.status !== "READY" || !lesson.mediaAsset.durationSec) return "stale";
  if (!Array.isArray(input.ranges) || input.ranges.length > 1000) throw new Error("Invalid playback");
  const duration = lesson.mediaAsset.durationSec;
  const current = mergePlayedRanges(input.ranges, duration);
  if (!current.length) return "ok";
  const membership = await teamTrackingMembership(viewer);
  if (!membership) return "ok";
  // Use existing audit JSON for cumulative played ranges across visits; no schema change.
  // Serializable retries prevent two tabs overwriting each other's coverage.
  for (let attempt = 0; ; attempt++) {
    try {
      await db.$transaction(async tx => {
        const previous = await tx.teamActionLog.findFirst({
          where: { actorId: membership.id, action: "PLAYBACK_PROGRESS", targetType: "TeamLesson", targetId: input.lessonId,
            detail: { path: ["version"], equals: lesson.version } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { detail: true },
        });
        const saved = previous?.detail as { ranges?: [number, number][] } | null;
        const merged = mergePlayedRanges([...(saved?.ranges ?? []), ...current], duration);
        const watched = playedSeconds(merged, duration) / duration >= 0.9;
        await tx.teamLessonProgress.upsert({
          where: { membershipId_lessonId: { membershipId: membership.id, lessonId: input.lessonId } },
          create: { restaurantId: input.restaurantId, membershipId: membership.id, lessonId: input.lessonId,
            lessonVersion: lesson.version, ...(watched ? { watchedAt: new Date() } : {}) },
          update: {},
        });
        if (watched) await tx.teamLessonProgress.updateMany({
          where: { membershipId: membership.id, lessonId: input.lessonId, lessonVersion: lesson.version, watchedAt: null },
          data: { watchedAt: new Date() },
        });
        await tx.teamActionLog.create({ data: { restaurantId: input.restaurantId, actorId: membership.id,
          action: "PLAYBACK_PROGRESS", targetType: "TeamLesson", targetId: input.lessonId, detail: { version: lesson.version, ranges: merged } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return "ok";
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}
