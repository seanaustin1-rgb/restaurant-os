import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ access: vi.fn(), db: vi.fn(), asset: vi.fn(), lesson: vi.fn(), publish: vi.fn(), queue: vi.fn(), save: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/team/access", async original => ({ ...await original<typeof import("@/lib/team/access")>(), requireTeamAccess: h.access }));
vi.mock("@/lib/team/db", () => ({ teamDb: h.db }));
vi.mock("@/lib/team/lessons", () => ({ createTeamLesson: h.save, publishTeamLesson: h.publish, publishQueuedLessons: h.queue }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { TeamAccessDenied } from "@/lib/team/access";
import { lessonUploadStatus, loadLessonDrafts } from "./actions";
beforeEach(() => {
  vi.clearAllMocks(); h.access.mockResolvedValue({ role: "CONTRIBUTOR", membershipId: "member" });
  h.asset.mockResolvedValue({ status: "PROCESSING", hasCaptions: false });
  h.lesson.mockResolvedValue({ status: "DRAFT" });
  h.db.mockReturnValue({ teamMediaAsset: { findFirst: h.asset }, teamLesson: { findFirst: h.lesson, findMany: h.list } });
});
describe("R1 upload status action", () => {
  it("limits contributors to their own drafts and returns no provider URLs", async () => {
    expect(await lessonUploadStatus("a", "asset", "lesson")).toEqual({ status: "PROCESSING", hasCaptions: false, lessonStatus: "DRAFT" });
    expect(h.access).toHaveBeenCalledWith("a", "CONTRIBUTOR");
    expect(h.lesson.mock.calls[0][0].where).toEqual({ id: "lesson", mediaAssetId: "asset", authorId: "member" });
    expect(h.asset.mock.calls[0][0].select).toEqual({ status: true, hasCaptions: true });
  });
  it("recovers a persisted publish intent when media is already READY", async () => {
    h.asset.mockResolvedValue({ status: "READY", hasCaptions: true });
    await lessonUploadStatus("a", "asset", "lesson");
    expect(h.queue).toHaveBeenCalledWith("a", "asset");
  });
  it("denies a foreign tenant or removed contributor before querying", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    await expect(lessonUploadStatus("b", "asset")).rejects.toBeInstanceOf(TeamAccessDenied);
    expect(h.db).not.toHaveBeenCalled();
  });
});

describe("R1 contributor draft review", () => {
  it("shows only a contributor's own uploaded drafts", async () => {
    await loadLessonDrafts("a");
    expect(h.access).toHaveBeenCalledWith("a", "CONTRIBUTOR");
    expect(h.list.mock.calls[0][0].where).toMatchObject({ authorId: "member", source: "UPLOAD", status: { in: ["DRAFT", "REVIEW"] } });
    expect(h.list.mock.calls[0][0].select.mediaAsset.select).toEqual({ status: true });
  });
  it("lets managers review team upload drafts, without exposing imported drafts", async () => {
    h.access.mockResolvedValue({ role: "MANAGER", membershipId: null });
    await loadLessonDrafts("a");
    expect(h.list.mock.calls[0][0].where).not.toHaveProperty("authorId");
    expect(h.list.mock.calls[0][0].where.source).toBe("UPLOAD");
  });
  it("denies another tenant or a MEMBER before listing", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    await expect(loadLessonDrafts("b")).rejects.toBeInstanceOf(TeamAccessDenied);
    expect(h.db).not.toHaveBeenCalled();
  });
});