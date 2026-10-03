import { describe, expect, it } from "vitest";
import { scopeTeamQuery } from "./db";

describe("Team Hub tenant scope", () => {
  it("keeps reads and writes within each of two tenants", () => {
    const filter = { where: { status: "PUBLISHED", OR: [{ type: "SHIFT_BRIEF" }] } };
    const a = scopeTeamQuery("TeamLesson", "findMany", filter, "tenant_a") as {
      where: { restaurantId: string; status: string; OR: object[] };
    };
    const b = scopeTeamQuery("TeamLesson", "findMany", filter, "tenant_b") as typeof a;

    expect(a.where).toEqual({ ...filter.where, restaurantId: "tenant_a" });
    expect(b.where).toEqual({ ...filter.where, restaurantId: "tenant_b" });
    expect(filter.where).not.toHaveProperty("restaurantId");

    const write = scopeTeamQuery(
      "TeamLessonProgress", "update", { where: { id: "progress_a" }, data: { watchedAt: new Date() } },
      "tenant_a",
    ) as { where: { restaurantId: string }; data: { restaurantId: string } };
    expect(write.where.restaurantId).toBe("tenant_a");
    expect(write.data.restaurantId).toBe("tenant_a");
  });

  it("rejects tenant overrides in predicates, payloads, and nested relation writes", () => {
    expect(() => scopeTeamQuery("TeamLesson", "findMany", {
      where: { OR: [{ restaurantId: "tenant_b" }] },
    }, "tenant_a")).toThrow(/override rejected/);

    expect(() => scopeTeamQuery("TeamLesson", "create", {
      data: { restaurantId: "tenant_b", title: "Wrong tenant" },
    }, "tenant_a")).toThrow(/override rejected/);

    expect(() => scopeTeamQuery("TeamLesson", "create", {
      data: { restaurant: { connect: { id: "tenant_b" } } },
    }, "tenant_a")).toThrow(/nested relation write rejected/);

    expect(() => scopeTeamQuery("TeamLesson", "upsert", {
      where: { id: "lesson" }, create: {}, update: { restaurantId: "tenant_b" },
    }, "tenant_a")).toThrow(/override rejected/);
  });

  it("scopes bulk creates and refuses unsupported Team operations", () => {
    const result = scopeTeamQuery("TeamMoment", "createMany", {
      data: [{ moment: "A" }, { moment: "B" }],
    }, "tenant_a") as { data: Array<{ restaurantId: string }> };
    expect(result.data.map((row) => row.restaurantId)).toEqual(["tenant_a", "tenant_a"]);
    expect(() => scopeTeamQuery("TeamMoment", "findRaw", {}, "tenant_a"))
      .toThrow(/Unsupported Team Hub operation/);
    expect(() => scopeTeamQuery("TeamMoment", "findMany", {}, ""))
      .toThrow(/explicit restaurantId/);
  });

});
