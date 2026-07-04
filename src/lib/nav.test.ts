import { describe, it, expect } from "vitest";
import { navLinksForRoles, NAV_LINKS } from "./nav";

const hrefs = (links: { href: string }[]) => links.map((l) => l.href);

const BROKERAGE_LINKS = [
  "/modules/brokerage",
  "/modules/brokerage/cockpit",
  "/modules/brokerage/agent-cockpit",
];
const PROPERTY_LINK = "/modules/rentals/cockpit";

describe("navLinksForRoles — business-type filtering", () => {
  it("hides every vertical link for a restaurant-only tenant", () => {
    const result = hrefs(navLinksForRoles(["OPERATOR"], ["RESTAURANT"]));
    for (const href of [...BROKERAGE_LINKS, PROPERTY_LINK]) {
      expect(result).not.toContain(href);
    }
    // Universal links are unaffected.
    expect(result).toContain("/dashboard");
    expect(result).toContain("/investor");
  });

  it("shows the brokerage links (but not the property cockpit) for a brokerage tenant", () => {
    const result = hrefs(navLinksForRoles(["OPERATOR"], ["REAL_ESTATE_BROKERAGE"]));
    for (const href of BROKERAGE_LINKS) expect(result).toContain(href);
    expect(result).not.toContain(PROPERTY_LINK);
  });

  it("shows the property cockpit (but not the brokerage links) for a vacation-rental tenant", () => {
    const result = hrefs(navLinksForRoles(["OPERATOR"], ["VACATION_RENTAL"]));
    expect(result).toContain(PROPERTY_LINK);
    for (const href of BROKERAGE_LINKS) expect(result).not.toContain(href);
  });

  it("shows all vertical links for an operator of both verticals", () => {
    const result = hrefs(navLinksForRoles(["OPERATOR"], ["REAL_ESTATE_BROKERAGE", "VACATION_RENTAL"]));
    for (const href of [...BROKERAGE_LINKS, PROPERTY_LINK]) expect(result).toContain(href);
  });

  it("skips business-type filtering when no business types are supplied (backward compatible)", () => {
    const noArg = hrefs(navLinksForRoles(["OPERATOR"]));
    const emptyArg = hrefs(navLinksForRoles(["OPERATOR"], []));
    for (const href of [...BROKERAGE_LINKS, PROPERTY_LINK]) {
      expect(noArg).toContain(href);
      expect(emptyArg).toContain(href);
    }
  });
});

describe("navLinksForRoles — role filtering", () => {
  it("keeps role scoping alongside business-type filtering", () => {
    // INVESTOR is a universal role but not an adjustment/owner role.
    const result = hrefs(navLinksForRoles(["INVESTOR"], ["REAL_ESTATE_BROKERAGE"]));
    expect(result).toContain("/modules/brokerage"); // ALL_ROLES + matching type
    expect(result).toContain("/dashboard");
    expect(result).not.toContain("/transactions"); // adjustment-only
    expect(result).not.toContain("/connections"); // owner-only
  });

  it("hides the brokerage Executive Cockpit from INVESTOR (locked decision 7)", () => {
    // The Executive Cockpit shows the named per-agent leaderboard — leadership-only.
    const investor = hrefs(navLinksForRoles(["INVESTOR"], ["REAL_ESTATE_BROKERAGE"]));
    expect(investor).not.toContain("/modules/brokerage/cockpit");
    // The agent-facing links stay visible to an investor of a brokerage tenant.
    expect(investor).toContain("/modules/brokerage/agent-cockpit");
    // A leadership viewer still sees it.
    const manager = hrefs(navLinksForRoles(["MANAGER"], ["REAL_ESTATE_BROKERAGE"]));
    expect(manager).toContain("/modules/brokerage/cockpit");
  });

  it("returns every link when no roles are supplied", () => {
    // Empty roles preserves the prior 'show all' behavior; no business types → no type filter.
    expect(hrefs(navLinksForRoles([]))).toEqual(hrefs(NAV_LINKS));
  });
});
