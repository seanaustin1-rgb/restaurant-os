# Financial Ledger Isolation

This product is intentionally anti-bloat: it consumes messy CRM/POS/QBO/PMS data, but it does not become a CRM, back-office checklist, or compliance suite.

The ledger boundary exists to keep Cash Oxygen, Profit First, Tax Vaults, Go-Live Coach, and investor reads trustworthy even when source systems use volatile custom fields.

## Layers

### 1. Raw Source Events

Table: `RawSourceEvent`

Stores source payloads mostly as received from Toast, QuickBooks, Plaid, Dotloop, SkySlope, Escapia, Guesty, or other systems.

Rules:

- Raw payloads never drive dashboard math directly.
- Source-specific custom fields stay here.
- Each event is uniquely keyed by business, source system, object type, and source object id.
- Payload hashes can be used to detect changed upstream records.

### 2. Normalized Financial Events

Table: `NormalizedFinancialEvent`

Converts raw source events into source-agnostic financial facts:

- revenue
- real revenue
- pass-through
- agent split
- COGS
- labor
- fixed OpEx
- tax liability
- owner pay
- debt service
- excluded/internal transfer

Rules:

- Every normalized event carries confidence and mapping status.
- Low-confidence events stay `PENDING_REVIEW`.
- Consultant/accountant/operator approval is captured with `approvedBy` and `approvedAt`.
- Dashboard modules may surface pending data as incomplete, but must not silently treat it as final.

### 3. Ledger Entries

Table: `LedgerEntry`

The clean, narrow financial ledger used by dashboard math and cash-movement decisions.

Rules:

- No raw source-specific custom fields are allowed here.
- All entries use stable internal accounts like `OPERATING_CASH`, `TAX_VAULT`, `FIXED_OPEX`, `AGENT_PAYABLE`, and `PROFIT`.
- Ledger entries can link back to normalized events for auditability.
- Go-Live Coach, Cash Oxygen, Tax Vault, Profit First, and investor matrix should read from this layer once the ledger is populated.

### 4. Mapping Rules

Table: `SourceMappingRule`

Business-specific rules that translate source records into normalized financial events and ledger accounts.

Rules:

- Rules are scoped by business and source system.
- Rules can be high-confidence automatic, or marked `requiresReview`.
- Consultants/accountants can tune mapping rules without changing the raw payload or ledger model.

### 5. Sync Exceptions

Table: `SyncException`

Explicitly tracks broken or risky imports.

Examples:

- missing mapping
- duplicate source event
- stale source
- unbalanced ledger
- invalid amount
- missing required field
- API error

Rules:

- Bad syncs should be visible and actionable.
- A dashboard number should be marked incomplete when blocking exceptions exist.
- Silent failure is not allowed.

## Product Constraint

CRMs, POS systems, and PMS tools can be chaotic. The financial heartbeat cannot be.

When in doubt:

1. Save the source payload in `RawSourceEvent`.
2. Normalize into a small set of financial event types.
3. Write only clean, reviewed facts to `LedgerEntry`.
4. Raise `SyncException` when confidence is not high enough.

