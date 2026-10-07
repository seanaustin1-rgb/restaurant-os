import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, TeamRole } from "@prisma/client";
const h = vi.hoisted(() => ({ access: vi.fn(), db: vi.fn(), lessons: vi.fn(), lesson: vi.fn(), membership: vi.fn(), seen: vi.fn() }));
vi.mock("./access", async original => ({ ...await original<typeof import("./access")>(), requireTeamAccess: h.access }));
vi.mock("./db", () => ({ teamDb: h.db }));
import { TeamAccessDenied, visibleLessonFilter, type TeamViewer } from "./access";
import { feedWhere, loadTeamFeed, teamFeedSummary, readTeamLesson, markTeamFeedSeen, lessonCardSelect } from "./feed";
const now = new Date("2026-10-07T12:00:00Z");
const viewer: TeamViewer = { restaurantId: "a", clerkUserId: "user", membershipId: "member", role: "MEMBER", departments: ["FOH"] };
type Row = { id: string; restaurantId: string; status: string; audience: string[]; managersOnly: boolean; publishedAt: Date; feedExpiresAt: Date | null; title: string; takeaway: string; category: string; tags: string[]; progress: { membershipId: string }[]; mediaAsset: { durationSec: number; hasCaptions: boolean } };
const rows: Row[] = [
  { id: "older", restaurantId: "a", status: "PUBLISHED", audience: [], managersOnly: false, publishedAt: new Date("2026-10-01"), feedExpiresAt: null, title: "Welcome", takeaway: "Make eye contact", category: "Hospitality", tags: ["welcome"], progress: [], mediaAsset: { durationSec: 120, hasCaptions: true } },
  { id: "new", restaurantId: "a", status: "PUBLISHED", audience: ["FOH"], managersOnly: false, publishedAt: new Date("2026-10-06"), feedExpiresAt: new Date("2026-10-20"), title: "Wine service", takeaway: "Present the label", category: "Pre-shift", tags: ["wine"], progress: [], mediaAsset: { durationSec: 180, hasCaptions: true } },
  { id: "boh", restaurantId: "a", status: "PUBLISHED", audience: ["BOH"], managersOnly: false, publishedAt: new Date("2026-10-06"), feedExpiresAt: null, title: "Kitchen", takeaway: "Kitchen", category: "Kitchen", tags: ["kitchen"], progress: [], mediaAsset: { durationSec: 60, hasCaptions: true } },
  { id: "manager", restaurantId: "a", status: "PUBLISHED", audience: [], managersOnly: true, publishedAt: new Date("2026-10-06"), feedExpiresAt: null, title: "Private wine", takeaway: "Private", category: "Leadership", tags: ["private"], progress: [], mediaAsset: { durationSec: 60, hasCaptions: true } },
  { id: "expired", restaurantId: "a", status: "PUBLISHED", audience: [], managersOnly: false, publishedAt: new Date("2026-09-23"), feedExpiresAt: now, title: "Old brief", takeaway: "Old wine list", category: "Pre-shift", tags: ["archive"], progress: [], mediaAsset: { durationSec: 120, hasCaptions: true } },
  { id: "draft", restaurantId: "a", status: "DRAFT", audience: [], managersOnly: false, publishedAt: new Date("2026-10-06"), feedExpiresAt: null, title: "Draft", takeaway: "Draft", category: "Private draft", tags: ["draft"], progress: [], mediaAsset: { durationSec: 60, hasCaptions: true } },
  { id: "tenant-b", restaurantId: "b", status: "PUBLISHED", audience: [], managersOnly: false, publishedAt: new Date("2026-10-06"), feedExpiresAt: null, title: "Other", takeaway: "Other", category: "Other", tags: ["other"], progress: [], mediaAsset: { durationSec: 60, hasCaptions: true } },
];
// Small in-memory Prisma predicate evaluator: assertions exercise observable lists/counts, not just mock calls.
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (condition as Record<string, unknown>[]).every(part => matches(row, part));
    if (key === "OR") return (condition as Record<string, unknown>[]).some(part => matches(row, part));
    if (condition === null || typeof condition !== "object" || condition instanceof Date) return String(row[key]) === String(condition);
    const filter = condition as Record<string, unknown>, value = row[key];
    if ("none" in filter) return !(value as Record<string, unknown>[]).some(part => matches(part, filter.none as Record<string, unknown>));
    if ("isEmpty" in filter) return (value as unknown[]).length === 0;
    if ("hasSome" in filter) return (value as unknown[]).some(item => (filter.hasSome as unknown[]).includes(item));
    if ("has" in filter) return (value as unknown[]).includes(filter.has);
    if ("contains" in filter) return String(value).toLowerCase().includes(String(filter.contains).toLowerCase());
    return Object.entries(filter).every(([operator, limit]) => {
      const a = value instanceof Date ? value.getTime() : String(value);
      const b = limit instanceof Date ? limit.getTime() : String(limit);
      return operator === "gt" ? a > b : operator === "lt" ? a < b : operator === "lte" ? a <= b : false;
    });
  });
}
let lastSeen: Date | null;
let fixtures: Row[];
beforeEach(() => {
  vi.clearAllMocks(); lastSeen = null; fixtures = structuredClone(rows);
  h.access.mockImplementation(async (tenant: string) => { if (tenant !== "a") throw new TeamAccessDenied(); return viewer; });
  h.lessons.mockImplementation(async ({ where, orderBy, take }: { where: Prisma.TeamLessonWhereInput; orderBy?: unknown; take?: number }) => {
    let result = fixtures.filter(row => matches(row, { ...where, restaurantId: "a" }));
    if (orderBy) result = result.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime() || b.id.localeCompare(a.id));
    return take ? result.slice(0, take) : result;
  });
  h.lesson.mockImplementation(async ({ where }) => fixtures.find(row => matches(row, { ...where, restaurantId: "a" })) ?? null);
  h.membership.mockImplementation(async () => ({ id: "member", lastFeedSeenAt: lastSeen }));
  h.seen.mockImplementation(async ({ data }) => { if (!lastSeen || data.lastFeedSeenAt > lastSeen) lastSeen = data.lastFeedSeenAt; return { count: 1 }; });
  h.db.mockReturnValue({ teamLesson: { findMany: h.lessons, findFirst: h.lesson }, teamMembership: { findFirst: h.membership, updateMany: h.seen } });
});
describe("Phase 4 R1 feed", () => {
  it("orders newest first, filters departments, and expires a shift brief at exactly 14 days", async () => {
    const result = await loadTeamFeed({ restaurantId: "a", asOf: now.toISOString() });
    expect(result.lessons.map(row => row.id)).toEqual(["new", "older"]);
    expect(h.lessons.mock.calls[0][0].orderBy).toEqual([{ publishedAt: "desc" }, { id: "desc" }]);
    expect((await loadTeamFeed({ restaurantId: "a", q: "old brief", asOf: now.toISOString() })).lessons.map(row => row.id)).toEqual(["expired"]);
    expect((await readTeamLesson("a", "expired"))?.id).toBe("expired");
  });
  it("searches takeaway and normalized tags, with intersecting category/tag chips", async () => {
    expect((await loadTeamFeed({ restaurantId: "a", q: "label", asOf: now.toISOString() })).lessons.map(row => row.id)).toEqual(["new"]);
    expect((await loadTeamFeed({ restaurantId: "a", q: "ARCHIVE", category: "Pre-shift", tag: "archive", asOf: now.toISOString() })).lessons.map(row => row.id)).toEqual(["expired"]);
  });
  it.each(["MEMBER", "CONTRIBUTOR"] as TeamRole[])("hides managers-only in %s feed, search, facets, counts and direct lesson even in MGMT", async role => {
    h.access.mockResolvedValue({ ...viewer, role, departments: ["FOH", "MGMT"] });
    expect((await loadTeamFeed({ restaurantId: "a", q: "private", asOf: now.toISOString() })).lessons).toEqual([]);
    expect(await readTeamLesson("a", "manager")).toBeNull();
    const summary = await teamFeedSummary("a", now);
    expect(summary.count).toBe(2); expect(summary.minutes).toBe(5);
    expect(summary.tags).not.toContain("private"); expect(summary.categories).not.toContain("Leadership");
  });
  it.each(["manager", "owner"])("allows %s to read managers-only regardless of department", async who => {
    h.access.mockResolvedValue({ ...viewer, role: "MANAGER", departments: [], membershipId: who === "owner" ? null : "member" });
    expect((await readTeamLesson("a", "manager"))?.id).toBe("manager");
    expect((await loadTeamFeed({ restaurantId: "a", q: "private", asOf: now.toISOString() })).lessons.map(row => row.id)).toEqual(["manager"]);
    expect((await teamFeedSummary("a", now)).count).toBe(4);
  });
  it("counts correctly across two sessions, excludes progress and preserves publications arriving during the first visit", async () => {
    fixtures[0].progress = [{ membershipId: "member" }];
    expect((await teamFeedSummary("a", now)).count).toBe(1);
    await markTeamFeedSeen("a", now.toISOString());
    fixtures.push({ ...fixtures[1], id: "later", publishedAt: new Date(now.getTime() + 1000) });
    const next = await teamFeedSummary("a", new Date(now.getTime() + 2000));
    expect(next.count).toBe(1); expect(next.unseenIds).toEqual(["later"]); expect(next.minutes).toBe(3);
    await markTeamFeedSeen("a", new Date(now.getTime() - 1000).toISOString());
    expect(lastSeen).toEqual(now);
    expect(h.seen.mock.calls[0][0].where).toEqual({ id: "member", OR: [{ lastFeedSeenAt: null }, { lastFeedSeenAt: { lt: now } }] });
  });
  it("paginates equal timestamps without gaps or duplicates", async () => {
    fixtures = Array.from({ length: 25 }, (_, index) => ({ ...fixtures[1], id: String(index).padStart(2, "0") }));
    const one = await loadTeamFeed({ restaurantId: "a", asOf: now.toISOString() });
    const two = await loadTeamFeed({ restaurantId: "a", asOf: now.toISOString(), cursor: one.cursor! });
    const three = await loadTeamFeed({ restaurantId: "a", asOf: now.toISOString(), cursor: two.cursor! });
    const ids = [...one.lessons, ...two.lessons, ...three.lessons].map(row => row.id);
    expect(ids).toHaveLength(25); expect(new Set(ids).size).toBe(25); expect(three.cursor).toBeNull();
  });
  it("uses a DTO select that cannot expose provider IDs, public playback URLs, or check answers", () => {
    expect(lessonCardSelect.mediaAsset.select).toEqual({ durationSec: true, hasCaptions: true });
    expect(lessonCardSelect).not.toHaveProperty("checkAnswer");
    expect(lessonCardSelect).not.toHaveProperty("mediaAssetId");
  });
  it("rejects another tenant before querying on feed, summary, lesson and visit writes", async () => {
    for (const operation of [() => loadTeamFeed({ restaurantId: "b" }), () => teamFeedSummary("b", now), () => readTeamLesson("b", "tenant-b"), () => markTeamFeedSeen("b", now.toISOString())]) {
      await expect(operation()).rejects.toBeInstanceOf(TeamAccessDenied);
    }
    expect(h.db).not.toHaveBeenCalled();
  });
  it("uses the same visibility predicate everywhere and rejects malformed cursors", () => {
    expect((feedWhere(viewer, { restaurantId: "a" }, now).AND as unknown[])[0]).toEqual(visibleLessonFilter(viewer));
    expect(() => feedWhere(viewer, { restaurantId: "a", cursor: "garbage" }, now)).toThrow("Invalid feed cursor");
    expect(() => feedWhere(viewer, { restaurantId: "a", cursor: Buffer.from("null").toString("base64url") }, now)).toThrow("Invalid feed cursor");
  });
});
