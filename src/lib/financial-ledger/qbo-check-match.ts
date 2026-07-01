import type { FinancialEventType, LedgerAccount, TapBucket } from "@prisma/client";

export interface BankCheckCandidate {
  id: string;
  date: Date;
  amount: number;
  description: string | null;
  sourceObjectId?: string | null;
}

export interface QboCheckCandidate {
  id: string;
  date: Date;
  amount: number;
  sourceObjectType: string;
  sourceObjectId: string;
  payee: string | null;
  checkNumber: string | null;
  accountName: string | null;
  categoryName: string | null;
  memo: string | null;
  eventType: FinancialEventType;
  ledgerAccount: LedgerAccount;
  tapBucket: TapBucket | null;
}

export interface QboCheckMatch {
  bank: BankCheckCandidate;
  qbo: QboCheckCandidate;
  score: number;
  reasons: string[];
}

const QBO_CHECK_TYPES = new Set(["check", "bill_payment", "billpayment", "payroll", "paycheck", "expense"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(payload: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, part) => {
      const record = asRecord(current);
      return record ? record[part] : undefined;
    }, payload);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readAmount(payload: unknown): number | null {
  const raw = readString(payload, ["TotalAmt", "Amount", "amount", "total", "totalAmount"]);
  if (!raw) return null;
  const amount = Number(String(raw).replace(/[$,]/g, ""));
  return Number.isFinite(amount) ? Math.abs(amount) : null;
}

function readDate(payload: unknown): Date | null {
  const raw = readString(payload, ["TxnDate", "PaymentDate", "MetaData.CreateTime", "date", "eventDate"]);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textIncludesAny(value: string, words: string[]): boolean {
  const lower = value.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function typeToMapping(sourceObjectType: string, payloadText: string): {
  eventType: FinancialEventType;
  ledgerAccount: LedgerAccount;
  tapBucket: TapBucket | null;
} {
  const type = sourceObjectType.toLowerCase();
  if (type.includes("payroll") || type.includes("paycheck") || textIncludesAny(payloadText, ["payroll", "wages", "salary"])) {
    return { eventType: "LABOR", ledgerAccount: "LABOR", tapBucket: "LABOR" };
  }
  if (textIncludesAny(payloadText, ["sales tax", "davo", "tax payable"])) {
    return { eventType: "TAX_LIABILITY", ledgerAccount: "TAX_VAULT", tapBucket: "TAX_SALES" };
  }
  if (textIncludesAny(payloadText, ["food", "cogs", "cost of goods"])) {
    return { eventType: "COGS", ledgerAccount: "COGS", tapBucket: "COGS_FOOD" };
  }
  return { eventType: "FIXED_OPEX", ledgerAccount: "FIXED_OPEX", tapBucket: "OPEX" };
}

export function bankCheckNumber(description: string | null): string | null {
  const match = (description ?? "").match(/\bcheck\s*#?\s*(\d+)\b/i);
  return match?.[1] ?? null;
}

export function isBankCheckDescription(description: string | null): boolean {
  return /\bcheck\b/i.test(description ?? "");
}

export function qboCheckCandidateFromRaw(input: {
  id: string;
  sourceObjectType: string;
  sourceObjectId: string;
  payload: unknown;
}): QboCheckCandidate | null {
  const sourceObjectType = input.sourceObjectType.toLowerCase();
  if (!QBO_CHECK_TYPES.has(sourceObjectType)) return null;

  const amount = readAmount(input.payload);
  const date = readDate(input.payload);
  if (!amount || !date) return null;

  const payee = readString(input.payload, [
    "EntityRef.name",
    "VendorRef.name",
    "EmployeeRef.name",
    "PayeeRef.name",
    "Name",
    "payee",
    "vendor",
    "employee",
  ]);
  const checkNumber = readString(input.payload, ["DocNumber", "CheckNum", "checkNumber", "check_number"]);
  const accountName = readString(input.payload, [
    "AccountRef.name",
    "Line.0.AccountBasedExpenseLineDetail.AccountRef.name",
    "account",
  ]);
  const categoryName = readString(input.payload, [
    "Line.0.AccountBasedExpenseLineDetail.AccountRef.name",
    "Line.0.ItemBasedExpenseLineDetail.ItemRef.name",
    "category",
  ]);
  const memo = readString(input.payload, ["PrivateNote", "Memo", "memo", "description"]);
  const payloadText = JSON.stringify(input.payload);
  const mapping = typeToMapping(sourceObjectType, payloadText);

  return {
    id: input.id,
    date,
    amount,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    payee,
    checkNumber,
    accountName,
    categoryName,
    memo,
    ...mapping,
  };
}

function daysBetween(a: Date, b: Date): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.abs(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / dayMs;
}

export function scoreQboCheckMatch(bank: BankCheckCandidate, qbo: QboCheckCandidate): QboCheckMatch | null {
  const reasons: string[] = [];
  let score = 0;

  if (Math.abs(Math.abs(bank.amount) - qbo.amount) > 0.01) return null;
  score += 50;
  reasons.push("amount");

  const days = daysBetween(bank.date, qbo.date);
  if (days > 7) return null;
  score += Math.max(0, 25 - days * 3);
  reasons.push(`date:${days}`);

  const bankCheck = bankCheckNumber(bank.description);
  if (bankCheck && qbo.checkNumber && bankCheck === qbo.checkNumber) {
    score += 35;
    reasons.push("check-number");
  }
  if (qbo.payee) {
    score += 5;
    reasons.push("qbo-payee");
  }
  if (qbo.eventType === "LABOR") {
    score += 5;
    reasons.push("qbo-payroll");
  }

  return { bank, qbo, score, reasons };
}

export function bestQboCheckMatch(
  bank: BankCheckCandidate,
  qboCandidates: QboCheckCandidate[],
  minimumScore = 68,
): QboCheckMatch | null {
  const matches = qboCandidates
    .map((candidate) => scoreQboCheckMatch(bank, candidate))
    .filter((match): match is QboCheckMatch => match !== null)
    .sort((a, b) => b.score - a.score || a.qbo.id.localeCompare(b.qbo.id));
  const best = matches[0] ?? null;
  return best && best.score >= minimumScore ? best : null;
}
