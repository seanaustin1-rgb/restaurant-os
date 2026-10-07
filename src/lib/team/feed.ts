import { teamTrackingMembership } from "./tracking";
import { Prisma } from "@prisma/client";
import { requireTeamAccess, visibleLessonFilter, type TeamViewer } from "./access";
import { teamDb } from "./db";

export const lessonCardSelect = {
  id: true, title: true, takeaway: true, category: true, tags: true, type: true,
  managersOnly: true, publishedAt: true, version: true,
  mediaAsset: { select: { durationSec: true, hasCaptions: true } },
} satisfies Prisma.TeamLessonSelect;
export type LessonCard = Prisma.TeamLessonGetPayload<{ select: typeof lessonCardSelect }>;
export type FeedLesson = Omit<LessonCard, "publishedAt"> & { publishedAt: string | null };
export type FeedInput = { restaurantId: string; q?: string; category?: string; tag?: string; cursor?: string; asOf?: string };
export function feedWhere(viewer: TeamViewer, input: FeedInput, now: Date): Prisma.TeamLessonWhereInput {
  const searching = !!(input.q?.trim() || input.category || input.tag);
  const conditions: Prisma.TeamLessonWhereInput[] = [visibleLessonFilter(viewer), { publishedAt: { lte: now } }];
  if (!searching) conditions.push({ OR: [{ feedExpiresAt: null }, { feedExpiresAt: { gt: now } }] });
  if (input.q?.trim()) conditions.push({ OR: [
    { title: { contains: input.q.trim(), mode: "insensitive" } },
    { takeaway: { contains: input.q.trim(), mode: "insensitive" } },
    { tags: { hasSome: input.q.trim().toLowerCase().split(/\s+/) } },
  ] });
  if (input.category) conditions.push({ category: input.category });
  if (input.tag) conditions.push({ tags: { has: input.tag } });
  if (input.cursor) {
    let cursor: { at: string; id: string };
    try { cursor = JSON.parse(Buffer.from(input.cursor, "base64url").toString()); }
    catch { throw new Error("Invalid feed cursor"); }
    if (!cursor || typeof cursor !== "object" || typeof cursor.id !== "string" || !cursor.id || typeof cursor.at !== "string" || !Number.isFinite(Date.parse(cursor.at))) throw new Error("Invalid feed cursor");
    const at = new Date(cursor.at);
    conditions.push({ OR: [{ publishedAt: { lt: at } }, { publishedAt: at, id: { lt: cursor.id } }] });
  }
  return { AND: conditions };
}
export async function loadTeamFeed(input: FeedInput) {
  const viewer = await requireTeamAccess(input.restaurantId);
  const now = input.asOf ? new Date(input.asOf) : new Date();
  if (!Number.isFinite(now.getTime()) || now.getTime() > Date.now() + 1000) throw new Error("Invalid feed time");
  const rows = await teamDb(input.restaurantId).teamLesson.findMany({
    where: feedWhere(viewer, input, now), select: lessonCardSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 13,
  });
  const lessons = rows.slice(0, 12);
  const last = lessons.at(-1);
  return {
    lessons: lessons.map((row): FeedLesson => ({ ...row, publishedAt: row.publishedAt?.toISOString() ?? null })),
    cursor: rows.length > 12 && last?.publishedAt ? Buffer.from(JSON.stringify({ at: last.publishedAt.toISOString(), id: last.id })).toString("base64url") : null,
    asOf: now.toISOString(),
  };
}
export async function teamFeedSummary(restaurantId: string, now: Date) {
  const viewer = await requireTeamAccess(restaurantId);
  const db = teamDb(restaurantId);
  const membership = await teamTrackingMembership(viewer);
  const unseen = await db.teamLesson.findMany({
    where: { AND: [
      feedWhere(viewer, { restaurantId }, now),
      ...(membership?.lastFeedSeenAt ? [{ publishedAt: { gt: membership.lastFeedSeenAt } }] : []),
      ...(membership ? [{ progress: { none: { membershipId: membership.id } } }] : []),
    ] }, select: { id: true, mediaAsset: { select: { durationSec: true } } },
  });
  const facets = await db.teamLesson.findMany({
    where: visibleLessonFilter(viewer), select: { category: true, tags: true },
  });
  return { unseenIds: unseen.map(row => row.id), count: unseen.length,
    minutes: Math.ceil(unseen.reduce((sum, row) => sum + (row.mediaAsset?.durationSec ?? 0), 0) / 60),
    categories: [...new Set(facets.map(row => row.category))].sort(),
    tags: [...new Set(facets.flatMap(row => row.tags))].sort(),
  };
}
export async function readTeamLesson(restaurantId: string, lessonId: string) {
  const viewer = await requireTeamAccess(restaurantId);
  return teamDb(restaurantId).teamLesson.findFirst({
    where: { id: lessonId, ...visibleLessonFilter(viewer) }, select: lessonCardSelect,
  });
}
export async function markTeamFeedSeen(restaurantId: string, asOf: string) {
  const viewer = await requireTeamAccess(restaurantId);
  const at = new Date(asOf);
  if (!Number.isFinite(at.getTime()) || at.getTime() > Date.now()) throw new Error("Invalid visit time");
  const membership = await teamTrackingMembership(viewer);
  if (!membership) return;
  await teamDb(restaurantId).teamMembership.updateMany({
    where: { id: membership.id, OR: [{ lastFeedSeenAt: null }, { lastFeedSeenAt: { lt: at } }] },
    data: { lastFeedSeenAt: at },
  });
}
