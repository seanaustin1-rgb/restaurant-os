import type {
  FinancialEventType,
  LedgerAccount,
  TapBucket,
} from "@prisma/client";

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
