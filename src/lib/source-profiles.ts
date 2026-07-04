import type { SourceCategory } from "./source-map";

export type SourceProfileId =
  | "boldtrail-crm"
  | "follow-up-boss-crm"
  | "boldtrail-backoffice"
  | "appfiles-transactions"
  | "escapia-operations"
  | "escapia-owner-statements";

export type SourceConnectionPath = "oauth" | "partner_api" | "admin_api" | "csv_export";
export type SourceApiSetupState = "csv_ready" | "import_requested" | "api_available" | "api_requested" | "connected" | "not_needed" | "blocked";
export type SourceCredentialIntakeKind = "approval" | "api_key" | "account_id" | "location_id" | "webhook" | "csv_export" | "identity";
export type SourceCredentialSensitivity = "none" | "restricted" | "secret";
export type SourceCredentialCollectionPath = "owner_oauth" | "secure_support" | "vendor_admin" | "csv_import" | "settings";

export const API_SETUP_REQUESTED_TEXT = "API setup requested.";
export const IMPORT_SETUP_REQUESTED_TEXT = "Import setup requested.";

export interface SourceProfile {
  id: SourceProfileId;
  label: string;
  vendor: "BoldTrail" | "Follow Up Boss" | "BoldTrail BackOffice" | "AppFiles" | "Escapia";
  category: SourceCategory;
  connectionPath: SourceConnectionPath;
  connectionLabel: string;
  clientSetup: string;
  consultantSetup: string;
  apiReality: string;
  csvFallback: string;
  importedEntities: string[];
  requiredIdentity: string[];
  apiAccessNeeds: string[];
  credentialIntake: SourceCredentialIntakeItem[];
  dashboardUnlocks: string[];
  riskNotes: string[];
}

export interface SourceCredentialIntakeItem {
  key: string;
  label: string;
  detail: string;
  kind: SourceCredentialIntakeKind;
  sensitivity: SourceCredentialSensitivity;
  required: boolean;
  collectVia: SourceCredentialCollectionPath;
}

export const SOURCE_PROFILES: Record<SourceProfileId, SourceProfile> = {
  "boldtrail-crm": {
    id: "boldtrail-crm",
    label: "BoldTrail CRM",
    vendor: "BoldTrail",
    category: "pipeline",
    connectionPath: "partner_api",
    connectionLabel: "API or CRM export",
    clientSetup: "Brokerage admin approves access or exports leads, campaigns, agent assignment, and pipeline stages.",
    consultantSetup: "Consultant can prep CSV exports and validate agent/source IDs before API access exists.",
    apiReality: "Use live API/webhook access only after the brokerage admin or vendor partner access is confirmed.",
    csvFallback: "CSV first: leads, campaigns, stages, assigned agent, source, expected value, and expected close date.",
    importedEntities: ["Agents", "Lead sources", "Campaign spend", "Pipeline stages", "Expected close dates"],
    requiredIdentity: ["agentId or agent email", "lead source", "campaign/source id", "pipeline stage", "expected close date"],
    apiAccessNeeds: ["Brokerage admin approval", "Read access to leads/pipeline/campaigns", "Agent user identifiers", "Webhook or export cadence"],
    credentialIntake: [
      { key: "admin-approval", label: "Brokerage admin approval", detail: "Confirms the CRM account owner approved API/export access.", kind: "approval", sensitivity: "none", required: true, collectVia: "vendor_admin" },
      { key: "api-token", label: "API token or partner access", detail: "Use secure support or vendor admin flow; do not paste tokens into notes.", kind: "api_key", sensitivity: "secret", required: false, collectVia: "secure_support" },
      { key: "agent-identity", label: "Agent IDs or emails", detail: "Required to match CRM activity to brokerage agents and accounting results.", kind: "identity", sensitivity: "restricted", required: true, collectVia: "csv_import" },
      { key: "webhook-cadence", label: "Webhook or export cadence", detail: "Defines whether activity updates are live, scheduled, or CSV-only.", kind: "webhook", sensitivity: "none", required: false, collectVia: "settings" },
    ],
    dashboardUnlocks: ["Commission pipeline", "Lead ROI", "Agent coaching", "45-90 day momentum"],
    riskNotes: [
      "Do not calculate final Company Dollar from CRM-only data.",
      "Agent identity must be matched to AppFiles/back-office and accounting records before ROI is trusted.",
    ],
  },
  "follow-up-boss-crm": {
    id: "follow-up-boss-crm",
    label: "Follow Up Boss CRM",
    vendor: "Follow Up Boss",
    category: "pipeline",
    connectionPath: "admin_api",
    connectionLabel: "Admin API key or CRM export",
    clientSetup: "Brokerage admin approves an API key or exports people, deals, users, lead sources, and pipeline status.",
    consultantSetup: "Consultant can start from CSV exports, then validate agent emails and lead-source names before the API key is used.",
    apiReality: "Follow Up Boss supports API-key access. Use an admin/broker key only when the brokerage explicitly approves account-wide CRM access.",
    csvFallback: "CSV first: people/leads, deals, users, assigned agent, source, stage, expected value, and expected close date.",
    importedEntities: ["Agents", "People/leads", "Deals", "Lead sources", "Pipeline stages", "Expected close dates"],
    requiredIdentity: ["agentId or agent email", "person/lead id", "deal id", "lead source", "pipeline stage", "expected close date"],
    apiAccessNeeds: ["Brokerage admin approval", "Follow Up Boss API key", "Account-wide scope confirmation", "Agent user identifiers", "CSV export fallback"],
    credentialIntake: [
      { key: "admin-approval", label: "Brokerage admin approval", detail: "Confirms account-wide CRM reporting is approved by the brokerage.", kind: "approval", sensitivity: "none", required: true, collectVia: "vendor_admin" },
      { key: "api-key", label: "Follow Up Boss API key", detail: "Secret. Collect only through secure support or a future encrypted credential screen.", kind: "api_key", sensitivity: "secret", required: false, collectVia: "secure_support" },
      { key: "scope", label: "Account-wide scope confirmation", detail: "Agent keys may only expose assigned contacts, so brokerage-wide reads need admin/broker scope.", kind: "approval", sensitivity: "restricted", required: true, collectVia: "vendor_admin" },
      { key: "agent-identity", label: "Agent user IDs or emails", detail: "Used to match people, deals, and activity to brokerage agents.", kind: "identity", sensitivity: "restricted", required: true, collectVia: "csv_import" },
    ],
    dashboardUnlocks: ["Commission pipeline", "Lead ROI", "Agent coaching", "45-90 day momentum"],
    riskNotes: [
      "CRM pipeline is forecast data, not closed cash.",
      "An agent-level API key may only see assigned contacts; use brokerage-approved admin scope for brokerage-wide reporting.",
    ],
  },
  "boldtrail-backoffice": {
    id: "boldtrail-backoffice",
    label: "BoldTrail BackOffice / Brokermint",
    vendor: "BoldTrail BackOffice",
    category: "pipeline",
    connectionPath: "csv_export",
    connectionLabel: "Back-office export first",
    clientSetup: "Brokerage admin exports commission files, agent ledgers, caps, splits, and transaction payout detail.",
    consultantSetup: "Consultant/accountant reviews split and cap fields against QBO deposits/checks before marking live.",
    apiReality: "Treat API access as partner/admin-assisted. CSV/export is the reliable pilot path.",
    csvFallback: "CSV first: agents, deals, GCI, split percent, cap paid, cap remaining, referral/franchise fees, payout status.",
    importedEntities: ["Agents", "Deals", "Commission worksheets", "Caps", "Splits", "Payout status"],
    requiredIdentity: ["agentId or agent email", "deal/file id", "GCI", "agent split", "cap paid", "closed/payout date"],
    apiAccessNeeds: ["Brokerage admin approval", "Read access to transaction/commission exports", "Agent cap ledger fields", "Closed payout status"],
    credentialIntake: [
      { key: "admin-approval", label: "Brokerage admin approval", detail: "Confirms commission/cap exports can be used for reporting.", kind: "approval", sensitivity: "none", required: true, collectVia: "vendor_admin" },
      { key: "transaction-export", label: "Transaction and cap export", detail: "CSV/export is the pilot path until partner API access is confirmed.", kind: "csv_export", sensitivity: "restricted", required: true, collectVia: "csv_import" },
      { key: "agent-ledger-fields", label: "Agent cap ledger fields", detail: "Needed to calculate retained yield and cap-cliff pressure.", kind: "identity", sensitivity: "restricted", required: true, collectVia: "csv_import" },
    ],
    dashboardUnlocks: ["Company Dollar", "Cap pressure", "Agent performance", "Production pacing"],
    riskNotes: [
      "Cap status must be date-aware; do not assume one split rate applies to all future closings.",
      "Closed payout data should reconcile to accounting before investor-facing use.",
    ],
  },
  "appfiles-transactions": {
    id: "appfiles-transactions",
    label: "AppFiles transaction files",
    vendor: "AppFiles",
    category: "pipeline",
    connectionPath: "csv_export",
    connectionLabel: "Transaction export first",
    clientSetup: "Brokerage/admin exports file status, executed contracts, compliance progress, and commission worksheets.",
    consultantSetup: "Consultant can map file statuses and flag missing commission worksheets before a live connector exists.",
    apiReality: "Assume export/manual import until AppFiles API/webhook access is confirmed for the brokerage.",
    csvFallback: "CSV first: file id, address, agent, status, contract date, expected close date, approved payout, worksheet values.",
    importedEntities: ["Transaction files", "File status", "Executed contracts", "Commission worksheets", "Approved payouts"],
    requiredIdentity: ["file id", "agentId or agent email", "status", "contract date", "expected close date", "commission worksheet"],
    apiAccessNeeds: ["Brokerage/admin approval", "Read access to file status and activity", "Commission worksheet export/API access", "Approved payout fields"],
    credentialIntake: [
      { key: "admin-approval", label: "Brokerage/admin approval", detail: "Confirms transaction-file data can be used for reporting.", kind: "approval", sensitivity: "none", required: true, collectVia: "vendor_admin" },
      { key: "file-export", label: "File status export", detail: "CSV/export should include status, dates, agents, and file IDs.", kind: "csv_export", sensitivity: "restricted", required: true, collectVia: "csv_import" },
      { key: "commission-worksheet", label: "Commission worksheet access", detail: "Required before projected Company Dollar can be trusted.", kind: "csv_export", sensitivity: "restricted", required: false, collectVia: "csv_import" },
    ],
    dashboardUnlocks: ["Pipeline confidence", "Commission file confidence", "Agent take-home forecast", "Brokerage coaching"],
    riskNotes: [
      "File status is not cash. Keep projected and reconciled closed cash separate.",
      "Compliance notes can be sensitive; do not expose raw file issues to investors.",
    ],
  },
  "escapia-operations": {
    id: "escapia-operations",
    label: "Escapia operations",
    vendor: "Escapia",
    category: "sales",
    connectionPath: "admin_api",
    connectionLabel: "Escapia API or export",
    clientSetup: "Property manager grants app/API access or exports unit, rate, fee, tax, restriction, booking, and channel data.",
    consultantSetup: "Consultant can validate unit IDs, rate freshness, channel names, and occupancy assumptions from export files.",
    apiReality: "Escapia Gateway can support inventory/rates/restrictions; booking/profit depth depends on account permissions.",
    csvFallback: "CSV/JSON first: units, bookings, nightly rate, channel, fees, taxes, restrictions, and reservation dates.",
    importedEntities: ["Properties/units", "Bookings", "Nightly rates", "Fees", "Taxes", "Restrictions", "Channels"],
    requiredIdentity: ["unitId", "bookingId", "check-in/out", "gross rent", "fees", "taxes", "channel"],
    apiAccessNeeds: ["Property manager approval", "Escapia Gateway/API credentials or export rights", "Property manager id", "Distributed unit ids", "Booking/rate permission scope"],
    credentialIntake: [
      { key: "pm-approval", label: "Property manager approval", detail: "Confirms the property manager approved Escapia Gateway/API or export access.", kind: "approval", sensitivity: "none", required: true, collectVia: "vendor_admin" },
      { key: "api-credentials", label: "Escapia Gateway credentials", detail: "Secret. Use secure support or future encrypted credential screen, not notes.", kind: "api_key", sensitivity: "secret", required: false, collectVia: "secure_support" },
      { key: "property-manager-id", label: "Property manager ID", detail: "Required to identify the enabled Escapia account.", kind: "account_id", sensitivity: "restricted", required: true, collectVia: "settings" },
      { key: "unit-ids", label: "Distributed unit IDs", detail: "Required to map imported inventory, bookings, and owner statements to properties.", kind: "identity", sensitivity: "restricted", required: true, collectVia: "csv_import" },
    ],
    dashboardUnlocks: ["Occupancy", "ADR", "RevPAR", "Booking pace", "Break-even occupancy"],
    riskNotes: [
      "Confirm whether ADR is gross guest rate or net manager receipts to avoid double-counting platform fees.",
      "Rate/inventory data alone does not prove owner proceeds.",
    ],
  },
  "escapia-owner-statements": {
    id: "escapia-owner-statements",
    label: "Escapia owner statements / QBO export",
    vendor: "Escapia",
    category: "costs",
    connectionPath: "csv_export",
    connectionLabel: "Owner statement export",
    clientSetup: "Property manager exports owner statements, property expenses, owner payouts, and maintenance/turn costs.",
    consultantSetup: "Accountant/consultant reconciles owner payouts and property expenses against QBO or bank records.",
    apiReality: "Use statements/export until property-level expense and payout fields are confirmed through API access.",
    csvFallback: "CSV first: unitId, period, gross revenue, owner payout, management fees, cleaning, maintenance, utilities, supplies.",
    importedEntities: ["Owner statements", "Property expenses", "Maintenance", "Cleaning", "Owner payouts"],
    requiredIdentity: ["unitId", "period start/end", "gross revenue", "owner payout", "management fee", "expense kind"],
    apiAccessNeeds: ["Property manager/accounting approval", "Owner statement exports", "Property-level expense tags", "QBO/bank reconciliation access"],
    credentialIntake: [
      { key: "accounting-approval", label: "Accounting approval", detail: "Confirms owner statements and property expenses are approved for import.", kind: "approval", sensitivity: "none", required: true, collectVia: "vendor_admin" },
      { key: "owner-statement-export", label: "Owner statement export", detail: "CSV/export should include unit, period, owner payout, fees, and expenses.", kind: "csv_export", sensitivity: "restricted", required: true, collectVia: "csv_import" },
      { key: "property-expense-tags", label: "Property expense tags", detail: "Needed to keep maintenance, cleaning, utilities, and supplies tied to the right unit.", kind: "identity", sensitivity: "restricted", required: true, collectVia: "csv_import" },
    ],
    dashboardUnlocks: ["Owner proceeds", "Maintenance drag", "Property profit", "Per-door performance"],
    riskNotes: [
      "Owner proceeds must be calculated after pass-through fees and property-level costs.",
      "Maintenance issues need property identity; portfolio averages should not be assigned to one unit.",
    ],
  },
};

export function isSourceProfileId(value: unknown): value is SourceProfileId {
  return typeof value === "string" && value in SOURCE_PROFILES;
}

export function sourceProfile(id: SourceProfileId | null | undefined): SourceProfile | null {
  return id ? SOURCE_PROFILES[id] ?? null : null;
}

export function buildSourceSetupNote(profile: SourceProfile): string {
  const requestedText = profile.connectionPath === "csv_export" ? IMPORT_SETUP_REQUESTED_TEXT : API_SETUP_REQUESTED_TEXT;
  return [
    `${profile.label}: ${requestedText}`,
    `Path: ${profile.connectionLabel}.`,
    `Needs: ${profile.apiAccessNeeds.join("; ")}.`,
    `Fallback: ${profile.csvFallback}`,
  ].join(" ");
}

export function buildSourceSelectedNote(profile: SourceProfile): string {
  return [
    `${profile.label}: selected during onboarding.`,
    `Path: ${profile.connectionLabel}.`,
    `Fallback: ${profile.csvFallback}`,
  ].join(" ");
}

export function sourceSetupChecklist(profile: SourceProfile): string[] {
  return [
    ...profile.apiAccessNeeds.map((item) => `API: ${item}`),
    ...profile.credentialIntake.map((item) => `Intake: ${item.label} via ${item.collectVia}${item.sensitivity === "secret" ? " (secret)" : ""}`),
    ...profile.requiredIdentity.map((item) => `Match key: ${item}`),
    `CSV fallback: ${profile.csvFallback}`,
  ];
}

export function sourceApiSetupState(input: {
  profile: SourceProfile;
  status: "PLANNED" | "CONNECTED" | "BLOCKED" | "NOT_NEEDED";
  notes?: string | null;
}): SourceApiSetupState {
  if (input.status === "CONNECTED") return "connected";
  if (input.status === "BLOCKED") return "blocked";
  if (input.status === "NOT_NEEDED") return "not_needed";
  if ((input.notes ?? "").includes(API_SETUP_REQUESTED_TEXT)) return "api_requested";
  if ((input.notes ?? "").includes(IMPORT_SETUP_REQUESTED_TEXT)) return "import_requested";
  return input.profile.connectionPath === "csv_export" ? "csv_ready" : "api_available";
}

export function sourceApiSetupLabel(state: SourceApiSetupState): { label: string; detail: string } {
  switch (state) {
    case "connected":
      return { label: "Connected", detail: "This source is represented by a connected source or approved import feed." };
    case "blocked":
      return { label: "Blocked", detail: "Setup needs vendor, owner, or support follow-up before it can move forward." };
    case "not_needed":
      return { label: "Skipped", detail: "This source is not needed for the current setup path." };
    case "api_requested":
      return { label: "API requested", detail: "Setup request is saved. Use CSV/import while vendor or admin access is pending." };
    case "import_requested":
      return { label: "Import planned", detail: "Import setup is saved. Use the CSV/export path before a live API is available." };
    case "api_available":
      return { label: "API path available", detail: "Request setup to capture the required access checklist; use CSV/import until approved." };
    case "csv_ready":
    default:
      return { label: "CSV ready", detail: "This source can start with an export/import before a live API exists." };
  }
}
