import type {
  FinancialEventType,
  FinancialMappingStatus,
  LedgerAccount,
  RuleMatchType,
  SyncExceptionSeverity,
  SyncExceptionType,
  TapBucket,
} from "@prisma/client";

export interface SourceMappingRuleInput {
  id: string;
  sourceSystem: string;
  sourceObjectType: string | null;
  sourceField: string | null;
  matchType: RuleMatchType;
  matchPattern: string;
  mapsToEventType: FinancialEventType;
  mapsToLedgerAccount: LedgerAccount;
  mapsToTapBucket: TapBucket | null;
  confidence: number;
  requiresReview: boolean;
  enabled: boolean;
}

export interface RawFinancialSourceInput {
  sourceSystem: string;
  sourceObjectType: string;
  payload: unknown;
}

export interface FinancialMappingDecision {
  ruleId: string | null;
  eventType: FinancialEventType | null;
  ledgerAccount: LedgerAccount | null;
  tapBucket: TapBucket | null;
  confidence: number;
  status: FinancialMappingStatus;
  exception: {
    severity: SyncExceptionSeverity;
    issueType: SyncExceptionType;
    message: string;
    detail?: Record<string, unknown>;
  } | null;
}

export interface LedgerDraftLine {
  ledgerAccount: LedgerAccount;
  debit: number;
  credit: number;
  cashEffect: number;
  taxEffect: number;
  allocationBucket: TapBucket | null;
  memo: string;
}

const CASH_IN_EVENT_TYPES = new Set<FinancialEventType>(["REVENUE", "REAL_REVENUE"]);
const CASH_NEUTRAL_EVENT_TYPES = new Set<FinancialEventType>(["INTERNAL_TRANSFER", "EXCLUDED"]);
const TAX_EVENT_TYPES = new Set<FinancialEventType>(["TAX_LIABILITY"]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function readPayloadField(payload: unknown, path: string | null | undefined): unknown {
  if (!path) return payload;
  return path.split(".").reduce<unknown>((current, part) => {
    const record = asRecord(current);
    return record ? record[part] : undefined;
  }, payload);
}

export function payloadSearchText(payload: unknown, sourceField?: string | null): string {
  const value = sourceField ? readPayloadField(payload, sourceField) : payload;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
}

export function sourceRuleMatches(
  rule: Pick<SourceMappingRuleInput, "matchType" | "matchPattern" | "sourceField">,
  payload: unknown,
): boolean {
  const haystack = payloadSearchText(payload, rule.sourceField);
  if (!haystack) return false;

  try {
    if (rule.matchType === "REGEX") {
      return new RegExp(rule.matchPattern, "i").test(haystack);
    }
    if (rule.matchType === "CHECK_MIN") {
      const threshold = Number(rule.matchPattern);
      const value = Number(haystack);
      return Number.isFinite(threshold) && Number.isFinite(value) && value >= threshold;
    }
    return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(rule.matchPattern)}`, "i").test(haystack);
  } catch {
    return false;
  }
}

export function chooseSourceMappingRule(
  input: RawFinancialSourceInput,
  rules: SourceMappingRuleInput[],
): SourceMappingRuleInput | null {
  const candidates = rules
    .filter((rule) => rule.enabled)
    .filter((rule) => rule.sourceSystem.toLowerCase() === input.sourceSystem.toLowerCase())
    .filter((rule) => !rule.sourceObjectType || rule.sourceObjectType === input.sourceObjectType)
    .filter((rule) => sourceRuleMatches(rule, input.payload))
    .sort((a, b) => b.confidence - a.confidence || b.matchPattern.length - a.matchPattern.length || a.id.localeCompare(b.id));

  return candidates[0] ?? null;
}

export function decideFinancialMapping(
  input: RawFinancialSourceInput,
  rules: SourceMappingRuleInput[],
  minimumAutoConfidence = 0.8,
): FinancialMappingDecision {
  const rule = chooseSourceMappingRule(input, rules);
  if (!rule) {
    return {
      ruleId: null,
      eventType: null,
      ledgerAccount: null,
      tapBucket: null,
      confidence: 0,
      status: "PENDING_REVIEW",
      exception: {
        severity: "WARNING",
        issueType: "MISSING_MAPPING",
        message: `No financial mapping rule matched ${input.sourceSystem}:${input.sourceObjectType}.`,
        detail: { sourceSystem: input.sourceSystem, sourceObjectType: input.sourceObjectType },
      },
    };
  }

  const needsReview = rule.requiresReview || rule.confidence < minimumAutoConfidence;
  return {
    ruleId: rule.id,
    eventType: rule.mapsToEventType,
    ledgerAccount: rule.mapsToLedgerAccount,
    tapBucket: rule.mapsToTapBucket,
    confidence: rule.confidence,
    status: needsReview ? "PENDING_REVIEW" : "APPROVED",
    exception: needsReview
      ? {
          severity: "INFO",
          issueType: "MISSING_MAPPING",
          message: `Financial mapping for ${input.sourceSystem}:${input.sourceObjectType} needs review before ledger posting.`,
          detail: { ruleId: rule.id, confidence: rule.confidence, requiresReview: rule.requiresReview },
        }
      : null,
  };
}

export function buildLedgerDraftLines(input: {
  eventType: FinancialEventType;
  ledgerAccount: LedgerAccount;
  amount: number;
  tapBucket?: TapBucket | null;
  memo?: string | null;
}): LedgerDraftLine[] {
  const amount = Math.abs(input.amount);
  const memo = input.memo ?? input.eventType.toLowerCase().replace(/_/g, " ");

  if (!Number.isFinite(amount) || amount <= 0) return [];
  if (CASH_NEUTRAL_EVENT_TYPES.has(input.eventType)) {
    return [
      {
        ledgerAccount: input.ledgerAccount,
        debit: 0,
        credit: 0,
        cashEffect: 0,
        taxEffect: 0,
        allocationBucket: input.tapBucket ?? null,
        memo,
      },
    ];
  }

  if (CASH_IN_EVENT_TYPES.has(input.eventType)) {
    return [
      {
        ledgerAccount: "OPERATING_CASH",
        debit: amount,
        credit: 0,
        cashEffect: amount,
        taxEffect: 0,
        allocationBucket: null,
        memo,
      },
      {
        ledgerAccount: input.ledgerAccount,
        debit: 0,
        credit: amount,
        cashEffect: 0,
        taxEffect: 0,
        allocationBucket: input.tapBucket ?? null,
        memo,
      },
    ];
  }

  return [
    {
      ledgerAccount: input.ledgerAccount,
      debit: amount,
      credit: 0,
      cashEffect: 0,
      taxEffect: TAX_EVENT_TYPES.has(input.eventType) ? amount : 0,
      allocationBucket: input.tapBucket ?? null,
      memo,
    },
    {
      ledgerAccount: "OPERATING_CASH",
      debit: 0,
      credit: amount,
      cashEffect: -amount,
      taxEffect: 0,
      allocationBucket: null,
      memo,
    },
  ];
}
