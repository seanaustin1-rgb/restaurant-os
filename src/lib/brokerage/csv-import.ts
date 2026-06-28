import type { BrokerageImportPayload } from "./normalized-import";

// Converts a pasted spreadsheet/back-office CSV export into the brokerage import
// payload by matching column headers to known field aliases — the "generic
// spreadsheet mapper" so an operator doesn't have to hand-write JSON. Pure +
// side-effect free; the route/UI feed the result straight into the normalizer.

export type BrokerageEntity = "agents" | "deals" | "leadSpend";

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
    { field: "source", type: "string", aliases: ["source", "leadsource", "channel"] },
    { field: "agentExternalId", type: "string", aliases: ["agentexternalid", "agentid", "agent"] },
    { field: "periodStart", type: "date", aliases: ["periodstart", "start", "startdate", "monthstart", "from"] },
    { field: "periodEnd", type: "date", aliases: ["periodend", "end", "enddate", "monthend", "to"] },
    { field: "spend", type: "number", aliases: ["spend", "cost", "adspend", "amount"] },
    { field: "attributedGci", type: "number", aliases: ["attributedgci", "gci", "attributedcommission"] },
    { field: "attributedDeals", type: "number", aliases: ["attributeddeals", "deals", "closings"] },
  ],
};

const norm = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, "");

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

export function csvToBrokerageRows(entity: BrokerageEntity, csv: string): CsvMapResult {
  const { headers, rows } = parseCsv(csv);
  const specs = SPECS[entity];

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
export function csvToBrokeragePayload(entity: BrokerageEntity, csv: string): BrokerageImportPayload {
  const { rows } = csvToBrokerageRows(entity, csv);
  return { [entity]: rows } as unknown as BrokerageImportPayload;
}
