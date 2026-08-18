import { describe, expect, it } from "vitest";
import { configuredSpiritVaultRestaurantId, vaultOperatorRoleWhere } from "./admin-access";

describe("Spirit Vault admin access", () => {
  it("trims the configured vault restaurant id", () => {
    expect(configuredSpiritVaultRestaurantId({ SPIRIT_VAULT_RESTAURANT_ID: " rest_demo " })).toBe("rest_demo");
    expect(configuredSpiritVaultRestaurantId({ SPIRIT_VAULT_RESTAURANT_ID: " " })).toBeNull();
  });

  it("scopes operator access to the configured restaurant when present", () => {
    expect(vaultOperatorRoleWhere("user_1", "rest_demo")).toEqual({
      clerkUserId: "user_1",
      role: { in: ["OPERATOR"] },
      restaurant: { businessType: "RESTAURANT", id: "rest_demo" },
    });
  });

  it("falls back to any restaurant operator when no vault restaurant is configured", () => {
    expect(vaultOperatorRoleWhere("user_1", null)).toEqual({
      clerkUserId: "user_1",
      role: { in: ["OPERATOR"] },
      restaurant: { businessType: "RESTAURANT" },
    });
  });
});
