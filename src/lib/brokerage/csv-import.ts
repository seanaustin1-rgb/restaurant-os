import type { BrokerageImportPayload } from "./normalized-import";

// Converts a pasted spreadsheet/back-office CSV export into the brokerage import
// payload by matching column headers to known field aliases — the "generic
// spreadsheet mapper" so an operator doesn't have to hand-write JSON. Pure +
// side-effect free; the route/UI feed the result straight into the normalizer.

export type BrokerageEntity = "agents" | "deals" | "leadSpend";
export type BrokerageCsvProfile = "generic" | "boldtrail" | "appfiles" | "lone_wolf" | "skyslope" | "loft47";

type FieldType = "string" | "number" | "date";

interface FieldSpec {
  field: string;
  type: FieldType;
  aliases: string[];
}

// Aliases are matched case-insensitively after stripping non-alphanumerics, so
// "Agent Split %", "agent_split", and "AgentSplit" all collapse to one key.
const SPECS: Record<BrokerageEntity, FieldSpec[]> = {
  agents: [
    { field: "externalAgentId", type: "string", aliases: ["externalagentid", "agentid", "id", "externalid"] },
    { field: "name", type: "string", aliases: ["name", "agentname", "agent", "fullname"] },
    { field: "email", type: "string", aliases: ["email", "emailaddress"] },
    { field: "status", type: "string", aliases: ["status", "agentstatus"] },
    { field: "defaultSplitPct", type: "number", aliases: ["defaultsplitpct", "split", "agentsplit", "splitpct", "commissionsplit"] },
    { field: "annualCap", type: "number", aliases: ["annualcap", "cap"] },
    { field: "capPaid", type: "number", aliases: ["cappaid", "cappaidtodate", "paidtocap"] },
  ],
  deals: [
    { field: "externalDealId", type: "string", aliases: ["externaldealid", "dealid", "id", "transactionid"] },
    { field: "agentExternalId", type: "string", aliases: ["agentexternalid", "agentid", "agent"] },
    { field: "label", type: "string", aliases: ["label", "address", "property", "propertyaddress", "deal", "dealname"] },
    { field: "market", type: "string", aliases: ["market", "city", "region"] },
    { field: "stage", type: "string", aliases: ["stage", "status", "dealstage"] },
    { field: "expectedCloseDate", type: "date", aliases: ["expectedclosedate", "expectedclose", "estimatedclose", "anticipatedclose"] },
    { field: "closedDate", type: "date", aliases: ["closeddate", "closedate", "closingdate", "settlementdate"] },
    { field: "salePrice", type: "number", aliases: ["saleprice", "price", "salesprice", "contractprice"] },
    { field: "gci", type: "number", aliases: ["gci", "grosscommission", "grosscommissionincome", "commission"] },
    { field: "agentSplitPct", type: "number", aliases: ["agentsplitpct", "split", "agentsplit", "splitpct"] },
    { field: "franchiseFee", type: "number", aliases: ["franchisefee", "franchise"] },
    { field: "referralFee", type: "number", aliases: ["referralfee", "referral"] },
    { field: "agentPayout", type: "number", aliases: ["agentpayout", "payout", "agentcommission"] },
    { field: "companyDollar", type: "number", aliases: ["companydollar", "cd", "brokerdollar", "retained"] },
    { field: "probabilityPct", type: "number", aliases: ["probabilitypct", "probability", "prob", "closeprobability", "likelihood"] },
  ],
  leadSpend: [
    { field: "externalLeadSpendId", type: "string", aliases: ["externalleadspendid", "leadspendid", "campaignid", "adcampaignid"] },
    { field: "source", type: "string", aliases: ["source", "leadsource", "channel"] },
    { field: "agentExternalId", type: "string", aliases: ["agentexternalid", "agentid", "agent"] },
    { field: "periodStart", type: "date", aliases: ["periodstart", "start", "startdate", "monthstart", "from"] },
    { field: "periodEnd", type: "date", aliases: ["periodend", "end", "enddate", "monthend", "to"] },
    { field: "spend", type: "number", aliases: ["spend", "cost", "adspend", "amount"] },
    { field: "attributedGci", type: "number", aliases: ["attributedgci", "gci", "attributedcommission"] },
    { field: "attributedDeals", type: "number", aliases: ["attributeddeals", "deals", "closings"] },
  ],
};

const PROFILE_ALIASES: Partial<
  Record<BrokerageCsvProfile, Partial<Record<BrokerageEntity, Record<string, string[]>>>>
> = {
  boldtrail: {
    agents: {
      externalAgentId: ["userid", "boldtrailuserid", "agentuuid"],
      name: ["agentname", "assignedagent", "owner"],
      email: ["agentemail", "useremail"],
    },
    deals: {
      externalDealId: ["transactionid", "dealid", "opportunityid", "leadid"],
      agentExternalId: ["userid", "agentid", "assignedagentid", "agentemail"],
      label: ["propertyaddress", "address", "listingaddress"],
      stage: ["pipelinestage", "status", "transactionstage"],
      expectedCloseDate: ["expectedclosedate", "estimatedclosingdate"],
      salePrice: ["saleprice", "listingprice", "propertyvalue"],
      gci: ["grosscommission", "estimatedcommission", "commissionamount"],
      probabilityPct: ["probability", "closeprobability"],
    },
    leadSpend: {
      externalLeadSpendId: ["campaignid", "leadid", "sourceid"],
      source: ["leadsource", "campaign", "source", "utm_source"],
      agentExternalId: ["userid", "agentid", "assignedagentid", "agentemail"],
      spend: ["adspend", "cost", "leadcost", "cpa"],
      attributedGci: ["attributedcommission", "estimatedgci"],
      attributedDeals: ["closings", "closeddeals", "deals"],
    },
  },
  appfiles: {
    agents: {
      externalAgentId: ["agentid", "agentemail", "realtorid"],
      name: ["agent", "realtor", "agentname"],
      email: ["agentemail", "realtoremail"],
    },
    deals: {
      externalDealId: ["fileid", "filenumber", "transactionid", "contractid"],
      agentExternalId: ["agentemail", "agentid", "realtorid"],
      label: ["propertyaddress", "fileaddress", "listingaddress"],
      stage: ["filestatus", "transactionstatus", "compliancestatus"],
      expectedCloseDate: ["scheduledclosingdate", "estimatedclosedate"],
      closedDate: ["closeddate", "settlementdate", "approveddate"],
      salePrice: ["saleprice", "contractprice", "purchaseprice"],
      gci: ["grosscommission", "commissionamount", "gci"],
      agentSplitPct: ["split", "agentsplit", "commissionpercentage"],
      agentPayout: ["agentcommission", "agentpayout"],
      companyDollar: ["companydollar", "brokeragenet", "officegross"],
    },
  },
  lone_wolf: {
    agents: {
      externalAgentId: ["associateid", "agentcode", "salespersonid"],
      name: ["associate", "salesperson", "agentfullname"],
    },
    deals: {
      externalDealId: ["transactionnumber", "transactionno", "filenumber", "dealnumber"],
      agentExternalId: ["associateid", "agentcode", "salespersonid"],
      label: ["civicaddress", "propertyaddress"],
      gci: ["grosscomm", "grosscommission", "grosscommissionincome"],
      agentPayout: ["agentcommission", "commissionpaid", "commissionpayable"],
      companyDollar: ["brokeragenet", "companynet", "officegross"],
      closedDate: ["completiondate", "settlementdate"],
    },
  },
  skyslope: {
    deals: {
      externalDealId: ["skyslopeid", "transactionid"],
      agentExternalId: ["agentemail", "agentid"],
      label: ["listingaddress", "propertyaddress"],
      stage: ["transactionstatus"],
      expectedCloseDate: ["estimatedclosedate", "scheduledclosedate"],
      closedDate: ["actualclosedate", "closeddate"],
      salePrice: ["purchaseprice", "salesprice"],
      gci: ["commissionamount", "grosscommission"],
    },
  },
  loft47: {
    agents: {
      externalAgentId: ["agentid", "advisorid", "repid"],
      name: ["advisor", "realtor"],
    },
    deals: {
      externalDealId: ["dealid", "tradeid", "transactionid"],
      label: ["address", "property"],
      closedDate: ["completiondate", "closedate"],
      gci: ["grosscommission", "grosscommissionincome"],
      agentPayout: ["agentnet", "agentcommission", "commissionpayable"],
      companyDollar: ["brokeragenet", "companydollar", "officegross"],
    },
  },
};

const SAMPLE_CSVS: Record<BrokerageCsvProfile, Partial<Record<BrokerageEntity, string>>> = {
  generic: {
    agents: "Agent ID,Name,Email,Default Split %,Annual Cap,Cap Paid\nA-1,Dana Reyes,dana@example.com,70,24000,18500",
    deals:
      "Deal ID,Agent,Property Address,Stage,GCI,Agent Split %,Closed Date\nD-101,A-1,412 Oak St,CLOSED,8750,70,2026-05-20",
    leadSpend: "Campaign ID,Source,Agent,Period Start,Period End,Spend,Attributed GCI,Deals\nC-1,Google PPC,A-1,2026-05-01,2026-05-31,1500,8750,1",
  },
  boldtrail: {
    agents: "User ID,Agent Name,Agent Email\nBT-1,Dana Reyes,dana@example.com",
    deals:
      "Transaction ID,User ID,Property Address,Pipeline Stage,Expected Close Date,Sale Price,Estimated Commission,Probability\nBT-D-101,BT-1,412 Oak St,Pending,2026-07-15,350000,8750,80",
    leadSpend: "Campaign ID,Campaign,User ID,Ad Spend,Attributed Commission,Closed Deals\nBT-C-1,Google PPC,BT-1,1500,8750,1",
  },
  appfiles: {
    agents: "Agent ID,Agent,Agent Email\nAF-1,Dana Reyes,dana@example.com",
    deals:
      "File ID,Agent Email,Property Address,File Status,Scheduled Closing Date,Sale Price,Gross Commission,Agent Split,Agent Commission,Company Dollar\nAF-101,dana@example.com,412 Oak St,Approved for Payout,2026-05-20,350000,8750,70,6125,2625",
  },
  lone_wolf: {
    agents: "Associate ID,Associate\nLW-1,Dana Reyes",
    deals:
      "Transaction Number,Associate ID,Civic Address,Completion Date,Gross Comm,Commission Paid,Company Net\nLW-101,LW-1,412 Oak St,2026-05-20,8750,6125,2625",
  },
  skyslope: {
    deals:
      "SkySlope ID,Agent Email,Listing Address,Transaction Status,Estimated Close Date,Purchase Price,Commission Amount\nSS-101,dana@example.com,412 Oak St,Pending,2026-07-15,350000,8750",
  },
  loft47: {
    agents: "Agent ID,Advisor\nL47-1,Dana Reyes",
    deals:
      "Deal ID,Address,Completion Date,Gross Commission Income,Agent Net,Company Dollar\nL47-101,412 Oak St,2026-05-20,8750,6125,2625",
  },
};

export function sampleBrokerageCsv(entity: BrokerageEntity, profile: BrokerageCsvProfile = "generic"): string {
  return SAMPLE_CSVS[profile][entity] ?? SAMPLE_CSVS.generic[entity] ?? "";
}

const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, "");

function specsFor(entity: BrokerageEntity, profile: BrokerageCsvProfile): FieldSpec[] {
  const profileAliases = PROFILE_ALIASES[profile]?.[entity] ?? {};
  return SPECS[entity].map((spec) => ({
    ...spec,
    aliases: [...spec.aliases, ...(profileAliases[spec.field] ?? []).map(norm)],
  }));
}

function toNumber(value: string): number | null {
  const cleaned = value.replace(/[$,%\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // swallow; \n handles the row break
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) pushRow();

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const [headers, ...body] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows: body };
}

export interface CsvMapResult {
  /** Loosely-typed mapped rows; fed straight into the normalizer for validation. */
  rows: Record<string, unknown>[];
  /** field -> the header it matched, for surfacing what was recognized. */
  mapped: Record<string, string>;
  /** headers in the CSV that matched no known field. */
  unmappedHeaders: string[];
}

export function csvToBrokerageRows(
  entity: BrokerageEntity,
  csv: string,
  profile: BrokerageCsvProfile = "generic",
): CsvMapResult {
  const { headers, rows } = parseCsv(csv);
  const specs = specsFor(entity, profile);

  // Build a header-index -> spec map by alias.
  const specByHeaderIndex = new Map<number, FieldSpec>();
  const mapped: Record<string, string> = {};
  const unmappedHeaders: string[] = [];
  headers.forEach((header, idx) => {
    const key = norm(header);
    const spec = specs.find((s) => s.aliases.includes(key) || norm(s.field) === key);
    if (spec && !mapped[spec.field]) {
      specByHeaderIndex.set(idx, spec);
      mapped[spec.field] = header;
    } else {
      unmappedHeaders.push(header);
    }
  });

  const out = rows.map((cells) => {
    const record: Record<string, unknown> = {};
    specByHeaderIndex.forEach((spec, idx) => {
      const raw = (cells[idx] ?? "").trim();
      if (raw === "") return;
      if (spec.type === "number") {
        const n = toNumber(raw);
        if (n != null) record[spec.field] = n;
      } else {
        record[spec.field] = raw;
      }
    });
    return record;
  });

  return { rows: out, mapped, unmappedHeaders };
}

/** Convenience: build a full payload from one entity's CSV (the UI does one entity at a time). */
export function csvToBrokeragePayload(
  entity: BrokerageEntity,
  csv: string,
  profile: BrokerageCsvProfile = "generic",
): BrokerageImportPayload {
  const { rows } = csvToBrokerageRows(entity, csv, profile);
  return { [entity]: rows } as unknown as BrokerageImportPayload;
}
