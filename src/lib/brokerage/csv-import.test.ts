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

  it("maps lead-spend campaign ids for dedupe-friendly imports", () => {
    const csv = "Campaign ID,Lead Source,Agent ID,Start Date,End Date,Spend\nC-1,Zillow,A-1,2026-06-01,2026-06-30,1500";
    const { rows, mapped } = csvToBrokerageRows("leadSpend", csv);
    expect(mapped.externalLeadSpendId).toBe("Campaign ID");
    expect(rows[0]).toMatchObject({
      externalLeadSpendId: "C-1",
      source: "Zillow",
      agentExternalId: "A-1",
      spend: 1500,
    });
  });

  it("maps BoldTrail lead-spend exports into agent-attributed spend", () => {
    const csv = [
      "Campaign,Assigned Agent ID,Lead Cost,Estimated GCI,Closed Deals",
      "Google PPC,BT-22,1200,18000,2",
    ].join("\n");
    const { rows, mapped } = csvToBrokerageRows("leadSpend", csv, "boldtrail");
    expect(mapped.source).toBe("Campaign");
    expect(mapped.agentExternalId).toBe("Assigned Agent ID");
    expect(mapped.spend).toBe("Lead Cost");
    expect(rows[0]).toMatchObject({
      source: "Google PPC",
      agentExternalId: "BT-22",
      spend: 1200,
      attributedGci: 18000,
      attributedDeals: 2,
    });
  });

  it("maps appFiles transaction exports into deal rows", () => {
    const csv = [
      "File Number,Agent Email,File Address,File Status,Commission Amount,Agent Commission,Company Dollar,Settlement Date",
      "AF-31,sam@example.com,31 Ocean Ave,Approved for Payout,14000,9800,4200,2026-06-25",
    ].join("\n");
    const { rows, mapped } = csvToBrokerageRows("deals", csv, "appfiles");
    expect(mapped.externalDealId).toBe("File Number");
    expect(mapped.stage).toBe("File Status");
    expect(mapped.companyDollar).toBe("Company Dollar");
    expect(rows[0]).toMatchObject({
      externalDealId: "AF-31",
      agentExternalId: "sam@example.com",
      label: "31 Ocean Ave",
      stage: "Approved for Payout",
      gci: 14000,
      agentPayout: 9800,
      companyDollar: 4200,
      closedDate: "2026-06-25",
    });
  });

  it("maps Lone Wolf-style deal exports without renaming headers", () => {
    const csv = [
      "Transaction No,Salesperson ID,Civic Address,Gross Comm,Company Net,Completion Date",
      "LW-1,A-7,1 Main St,10000,2500,2026-06-01",
    ].join("\n");
    const { rows, mapped } = csvToBrokerageRows("deals", csv, "lone_wolf");
    expect(mapped.externalDealId).toBe("Transaction No");
    expect(mapped.agentExternalId).toBe("Salesperson ID");
    expect(mapped.companyDollar).toBe("Company Net");
    expect(rows[0]).toMatchObject({
      externalDealId: "LW-1",
      agentExternalId: "A-7",
      label: "1 Main St",
      gci: 10000,
      companyDollar: 2500,
      closedDate: "2026-06-01",
    });
  });

  it("maps SkySlope-style deal exports without affecting generic parsing", () => {
    const csv = [
      "SkySlope ID,Agent Email,Listing Address,Commission Amount,Purchase Price,Actual Close Date",
      "SS-9,dana@example.com,9 Pine Rd,12000,400000,2026-06-12",
    ].join("\n");
    const { rows, mapped } = csvToBrokerageRows("deals", csv, "skyslope");
    expect(mapped.externalDealId).toBe("SkySlope ID");
    expect(mapped.agentExternalId).toBe("Agent Email");
    expect(mapped.salePrice).toBe("Purchase Price");
    expect(rows[0]).toMatchObject({
      externalDealId: "SS-9",
      agentExternalId: "dana@example.com",
      label: "9 Pine Rd",
      gci: 12000,
      salePrice: 400000,
      closedDate: "2026-06-12",
    });

    const generic = csvToBrokerageRows("deals", "Deal ID,Agent,GCI\nD1,A-1,5000", "generic");
    expect(generic.rows[0]).toMatchObject({ externalDealId: "D1", agentExternalId: "A-1", gci: 5000 });
  });

  it("feeds cleanly into the normalizer and derives Company Dollar", () => {
    const csv = "Deal ID,Property,GCI,Agent Split %,Franchise Fee\nD1,1 Oak St,10000,70,600";
    const payload = csvToBrokeragePayload("deals", csv);
    const { deals } = normalizeBrokerageImport({ restaurantId: "r1" }, payload);
    expect(deals).toHaveLength(1);
    expect(deals[0].companyDollar).toBeCloseTo(2400, 2); // 10000 - 7000 - 600
  });

  it("passes profile-specific rows through csvToBrokeragePayload", () => {
    const csv = "Trade ID,Property,Gross Commission,Brokerage Net\nL47-1,5 Lake Dr,9000,2700";
    const payload = csvToBrokeragePayload("deals", csv, "loft47");
    const { deals } = normalizeBrokerageImport({ restaurantId: "r1" }, payload);
    expect(deals).toHaveLength(1);
    expect(deals[0].externalDealId).toBe("L47-1");
    expect(deals[0].companyDollar).toBe(2700);
  });
});
