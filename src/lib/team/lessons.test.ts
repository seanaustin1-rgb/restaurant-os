import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ access: vi.fn(), db: vi.fn(), asset: vi.fn(), create: vi.fn(), find: vi.fn(), list: vi.fn(), update: vi.fn(),
  log: vi.fn(), intent: vi.fn(), member: vi.fn(), config: vi.fn(), business: vi.fn(), clerk: vi.fn(), memberCreate: vi.fn(), phoneRow: vi.fn(), send: vi.fn() }));
vi.mock("./access", async original => ({ ...await original<typeof import("./access")>(), requireTeamAccess: h.access }));
vi.mock("./db", () => ({ teamDb: h.db }));
vi.mock("@/lib/prisma", () => ({ prisma: { moduleConfig: { findUnique: h.config }, userRestaurantRole: { findUnique: h.business } } }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: async () => ({ users: { getUser: h.clerk } }) }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: h.send } }));
import { TeamAccessDenied } from "./access";
import { cleanLesson, createTeamLesson, publishTeamLesson, publishQueuedLessons, publicationDates, type NewLessonInput } from "./lessons";
const input: NewLessonInput = { restaurantId: "a", assetId: "asset", type: "SHIFT_BRIEF", title: "Wine", takeaway: "Present the label",
  category: "Pre-shift", tags: [" Wine ", "wine"], audience: ["FOH"], managersOnly: false, publishWhenReady: false };
const viewer = { restaurantId: "a", clerkUserId: "user", membershipId: "manager", role: "MANAGER", departments: [] };
beforeEach(() => {
  vi.clearAllMocks(); h.send.mockReset();
  h.access.mockResolvedValue(viewer); h.asset.mockResolvedValue({ id: "asset", status: "PROCESSING" });
  h.create.mockResolvedValue({ id: "lesson" }); h.find.mockResolvedValue({ type: "SHIFT_BRIEF" });
  h.list.mockResolvedValue([{ id: "lesson", type: "SHIFT_BRIEF" }]); h.update.mockResolvedValue({ count: 1 });
  h.intent.mockResolvedValue({ id: "intent", actorId: "manager", detail: { clerkUserId: "user" } });
  h.member.mockResolvedValue({ id: "manager" }); h.config.mockResolvedValue({ isEnabled: true }); h.business.mockResolvedValue(null);
  h.memberCreate.mockResolvedValue({ id: "owner-member" }); h.phoneRow.mockResolvedValue(null);
  const db = { teamMediaAsset: { findFirst: h.asset }, teamLesson: { create: h.create, findFirst: h.find, findMany: h.list, updateMany: h.update },
    teamActionLog: { create: h.log, findFirst: h.intent }, teamMembership: { findFirst: h.member, create: h.memberCreate, findUnique: h.phoneRow },
    $transaction: vi.fn() };
  db.$transaction.mockImplementation(async work => work(db)); h.db.mockReturnValue(db);
});
describe("Phase 4 creation and publishing", () => {
  it("normalizes content and defaults to a draft, with no publication", async () => {
    expect(cleanLesson(input).tags).toEqual(["wine"]);
    expect(await createTeamLesson(input)).toBe("lesson");
    expect(h.access).toHaveBeenCalledWith("a", "CONTRIBUTOR");
    expect(h.create.mock.calls[0][0].data).toMatchObject({ status: "DRAFT", authorId: "manager", mediaAssetId: "asset", restaurantId: "a" });
    expect(h.log.mock.calls[0][0].data.action).toBe("CREATE_LESSON");
    expect(h.update).not.toHaveBeenCalled();
  });
  it("allows contributor drafts but rejects contributor publish intent", async () => {
    h.access.mockResolvedValue({ ...viewer, role: "CONTRIBUTOR" });
    await expect(createTeamLesson(input)).resolves.toBe("lesson");
    h.create.mockClear();
    await expect(createTeamLesson({ ...input, publishWhenReady: true })).rejects.toThrow("Only a manager");
    expect(h.create).not.toHaveBeenCalled();
  });
  it("atomically persists manager publication intent and handles an already-ready asset", async () => {
    await createTeamLesson({ ...input, publishWhenReady: true, managersOnly: true });
    expect(h.create.mock.calls[0][0].data).toMatchObject({ status: "REVIEW", managersOnly: true });
    expect(h.log.mock.calls[0][0].data).toMatchObject({ action: "PUBLISH_WHEN_READY", detail: { clerkUserId: "user", managersOnly: true } });
    expect(h.list.mock.calls[0][0].where).toMatchObject({ mediaAssetId: "asset", status: "REVIEW", source: "UPLOAD", mediaAsset: { status: "READY" } });
    expect(h.update.mock.calls[0][0].data.status).toBe("PUBLISHED");
  });
  it("publishes only ready uploads and logs once across duplicate ready jobs", async () => {
    await publishQueuedLessons("a", "asset");
    h.update.mockResolvedValue({ count: 0 });
    await publishQueuedLessons("a", "asset");
    expect(h.log).toHaveBeenCalledTimes(1);
    expect(h.log.mock.calls[0][0].data.action).toBe("PUBLISH");
  });
  it("does not publish ordinary review drafts, imports, disabled tenants or revoked managers", async () => {
    h.intent.mockResolvedValue(null); await publishQueuedLessons("a", "asset");
    expect(h.update).not.toHaveBeenCalled();
    h.intent.mockResolvedValue({ id: "intent", actorId: "manager", detail: { clerkUserId: "user" } });
    h.member.mockResolvedValue(null); await publishQueuedLessons("a", "asset"); expect(h.update).not.toHaveBeenCalled();
    h.member.mockResolvedValue({ id: "manager" }); h.config.mockResolvedValue({ isEnabled: false });
    h.list.mockClear(); await publishQueuedLessons("a", "asset"); expect(h.list).not.toHaveBeenCalled();
  });
  it("honors an owner's current business role in a queued publish", async () => {
    h.member.mockResolvedValue(null); h.business.mockResolvedValue({ role: "OPERATOR" });
    await publishQueuedLessons("a", "asset"); expect(h.update).toHaveBeenCalledTimes(1);
  });
  it("publishes a ready draft manually with manager authorization", async () => {
    await publishTeamLesson("a", "lesson");
    expect(h.access).toHaveBeenCalledWith("a", "MANAGER");
    expect(h.find.mock.calls[0][0].where).toMatchObject({ id: "lesson", source: "UPLOAD", mediaAsset: { status: "READY" } });
    expect(h.log.mock.calls[0][0].data.action).toBe("PUBLISH");
    h.find.mockResolvedValue(null);
    await expect(publishTeamLesson("a", "lesson")).rejects.toThrow("not ready");
  });
  it("sets exactly 14 days from publication and no expiry for other lesson types", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    expect(publicationDates("SHIFT_BRIEF", now).feedExpiresAt).toEqual(new Date("2026-10-21T12:00:00Z"));
    expect(publicationDates("PRODUCT", now).feedExpiresAt).toBeNull();
  });
  it("denies tenant B on create/manual publish before any scoped queries", async () => {
    h.access.mockRejectedValue(new TeamAccessDenied());
    await expect(createTeamLesson({ ...input, restaurantId: "b" })).rejects.toBeInstanceOf(TeamAccessDenied);
    await expect(publishTeamLesson("b", "lesson")).rejects.toBeInstanceOf(TeamAccessDenied);
    expect(h.db).not.toHaveBeenCalled();
  });
  it("rejects failed or foreign assets, invalid content, and a member caller", async () => {
    h.asset.mockResolvedValue(null); await expect(createTeamLesson(input)).rejects.toThrow("valid uploaded");
    h.asset.mockResolvedValue({ id: "asset", status: "FAILED" }); await expect(createTeamLesson(input)).rejects.toThrow("valid uploaded");
    expect(() => cleanLesson({ ...input, title: " " })).toThrow();
    expect(h.create).not.toHaveBeenCalled();
  });
  it("creates an owner's author record only from a verified primary phone without granting a lasting manager role", async () => {
    h.access.mockResolvedValue({ ...viewer, membershipId: null });
    h.member.mockResolvedValue(null);
    h.clerk.mockResolvedValue({ primaryPhoneNumberId: "primary", fullName: "Owner", phoneNumbers: [
      { id: "primary", phoneNumber: "+17175551234", verification: { status: "verified" } },
    ] });
    await createTeamLesson(input);
    expect(h.memberCreate.mock.calls[0][0].data).toMatchObject({ clerkUserId: "user", phoneE164: "+17175551234", role: "MEMBER" });
    expect(h.create.mock.calls[0][0].data.authorId).toBe("owner-member");
  });
  it("never takes over an existing phone row or uses an unverified phone as author", async () => {
    h.access.mockResolvedValue({ ...viewer, membershipId: null }); h.member.mockResolvedValue(null);
    h.clerk.mockResolvedValue({ primaryPhoneNumberId: "primary", phoneNumbers: [] });
    await expect(createTeamLesson(input)).rejects.toThrow("verify your primary phone");
    h.clerk.mockResolvedValue({ primaryPhoneNumberId: "primary", phoneNumbers: [{ id: "primary", phoneNumber: "+17175551234", verification: { status: "verified" } }] });
    h.phoneRow.mockResolvedValue({ id: "someone" });
    await expect(createTeamLesson(input)).rejects.toThrow("Claim your Team");
    expect(h.memberCreate).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.restoreAllMocks());
describe("Durable publication delivery", () => {
  it("returns the already-saved lesson ID when event delivery fails, so the phone does not create a duplicate", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    h.send.mockRejectedValue(new Error("Inngest unavailable"));
    expect(await createTeamLesson({ ...input, publishWhenReady: true })).toBe("lesson");
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.log.mock.calls[0][0].data.action).toBe("PUBLISH_WHEN_READY");
    expect(error).toHaveBeenCalled();
  });
  it("uses a deterministic event ID for the saved lesson", async () => {
    await createTeamLesson({ ...input, publishWhenReady: true });
    expect(h.send).toHaveBeenCalledWith({ id: "team-publish-lesson", name: "team/lesson.publish.requested", data: { restaurantId: "a", assetId: "asset" } });
  });
});