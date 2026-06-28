import { describe, expect, it } from "vitest";
import { parseCsv, csvToBrokerageRows, csvToBrokeragePayload } from "./csv-import";
import { normalizeBrokerageImport } from "./normalized-import";

describe("parseCsv", () => {
  it("handles quoted fields, embedded commas, and CRLF", () => {
    const { headers, rows } = parseCsv('a,b,c\r\n1,"x, y",3\r\n4,5,6\n');
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      ["1", "x, y", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("ignores blank lines", () => {
    const { rows } = parseCsv("a,b\n\n1,2\n");
    expect(rows).toEqual([["1", "2"]]);
  });
});

describe("csvToBrokerageRows", () => {
  it("maps deal headers by alias and coerces money/percent strings to numbers", () => {
    const csv = ["Deal ID,Agent,Property Address,GCI,Agent Split %,Closed Date", 'D1,A-1,"412 Oak St, Unit 2","$8,750",70%,2026-05-20'].join(
      "\n",
    );
    const { rows, mapped } = csvToBrokerageRows("deals", csv);
    expect(mapped.gci).toBe("GCI");
    expect(mapped.label).toBe("Property Address");
    expect(rows).toHaveLength(1);
    const deal = rows[0] as Record<string, unknown>;
    expect(deal.externalDealId).toBe("D1");
    expect(deal.agentExternalId).toBe("A-1");
    expect(deal.label).toBe("412 Oak St, Unit 2");
    expect(deal.gci).toBe(8750);
    expect(deal.agentSplitPct).toBe(70);
    expect(deal.closedDate).toBe("2026-05-20");
  });

  it("reports headers it could not map", () => {
    const { unmappedHeaders } = csvToBrokerageRows("agents", "Agent ID,Name,Favorite Color\nA-1,Dana,Blue");
    expect(unmappedHeaders).toEqual(["Favorite Color"]);
  });

  it("feeds cleanly into the normalizer and derives Company Dollar", () => {
    const csv = "Deal ID,Property,GCI,Agent Split %,Franchise Fee\nD1,1 Oak St,10000,70,600";
    const payload = csvToBrokeragePayload("deals", csv);
    const { deals } = normalizeBrokerageImport({ restaurantId: "r1" }, payload);
    expect(deals).toHaveLength(1);
    expect(deals[0].companyDollar).toBeCloseTo(2400, 2); // 10000 - 7000 - 600
  });
});
