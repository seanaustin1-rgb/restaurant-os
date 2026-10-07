import { describe, expect, it } from "vitest";
import { teamReturnPath } from "./login-return";
describe("Team deep-link return after login", () => {
  it("preserves the exact lesson and explicit tenant", () => {
    const path = "/team/learn/lesson_1?restaurantId=tenant_a";
    expect(teamReturnPath("https://app.test" + path, "https://app.test")).toBe(path);
    expect(teamReturnPath(path, "https://app.test")).toBe(path);
    expect(teamReturnPath("/team?restaurantId=tenant_a", "https://app.test")).toBe("/team?restaurantId=tenant_a");
  });
  it.each(["https://other.test/team/learn/lesson_1", "//other.test/team/learn/x", "/dashboard", "/teamwork", "javascript:alert(1)"])("rejects %s", value => {
    expect(teamReturnPath(value, "https://app.test")).toBeUndefined();
  });
});
