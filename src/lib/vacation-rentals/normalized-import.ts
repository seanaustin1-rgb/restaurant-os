import { createHash } from "node:crypto";
import type { RentalExpenseKind, RentalIssueStatus, VacationRentalSourceKind } from "@prisma/client";

export interface VacationRentalImportContext {
  restaurantId: string;
  sourceId?: string | null;
  importBatchId?: string | null;
  sourceName: string;
  sourceKind: VacationRentalSourceKind;
}

export interface RawRentalProperty {
  externalUnitId: string;
  name: string;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sleeps?: number | null;
  active?: boolean;
  rawPayload?: unknown;
}

export interface RawRentalBooking {
  externalBookingId?: string | null;
  externalUnitId: string;
  channel?: string | null;
  guestName?: string | null;
  bookedAt?: string | Date | null;
  checkIn: string | Date;
  checkOut: string | Date;
  nights?: number | null;
  grossRent: number;
  fees?: number | null;
  taxes?: number | null;
  platformFees?: number | null;
  ownerPayout?: number | null;
  status?: string | null;
  rawPayload?: unknown;
}

export interface RawRentalOwnerStatement {
  externalStatementId?: string | null;
  externalUnitId: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  grossRevenue?: number | null;
  ownerPayout?: number | null;
  managementFees?: number | null;
  expenses?: number | null;
  reserveHeld?: number | null;
  rawPayload?: unknown;
}

export interface RawRentalExpense {
  externalExpenseId?: string | null;
  externalUnitId: string;
  kind?: RentalExpenseKind | null;
  vendor?: string | null;
  description?: string | null;
  date: string | Date;
  amount: number;
  rawPayload?: unknown;
}

export interface RawRentalMaintenanceIssue {
  externalIssueId?: string | null;
  externalUnitId: string;
  title: string;
  description?: string | null;
  status?: RentalIssueStatus | null;
  openedAt: string | Date;
  resolvedAt?: string | Date | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  isRepeatIssue?: boolean;
  rawPayload?: unknown;
}

export interface RawRentalReview {
  externalReviewId?: string | null;
  externalUnitId: string;
  platform: string;
  rating?: number | null;
  reviewText?: string | null;
  reviewedAt: string | Date;
  responseHours?: number | null;
  rawPayload?: unknown;
}

export interface VacationRentalImportPayload {
  properties?: RawRentalProperty[];
  bookings?: RawRentalBooking[];
  ownerStatements?: RawRentalOwnerStatement[];
  expenses?: RawRentalExpense[];
  maintenanceIssues?: RawRentalMaintenanceIssue[];
  reviews?: RawRentalReview[];
}

export interface NormalizedImportSummary {
  properties: number;
  bookings: number;
  ownerStatements: number;
  expenses: number;
  maintenanceIssues: number;
  reviews: number;
  accepted: number;
  rejected: number;
  missingUnitReferences: string[];
}

type BaseRow = {
  restaurantId: string;
  sourceId: string | null;
  importBatchId: string | null;
  rawPayload?: unknown;
};

export type NormalizedRentalProperty = BaseRow & {
  externalUnitId: string;
  name: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sleeps: number | null;
  active: boolean;
};

export type NormalizedRentalBooking = BaseRow & {
  externalBookingId: string;
  externalUnitId: string;
  channel: string | null;
  guestName: string | null;
  bookedAt: string | Date | null;
  checkIn: string | Date;
  checkOut: string | Date;
  nights: number;
  grossRent: number;
  fees: number;
  taxes: number;
  platformFees: number;
  ownerPayout: number | null;
  status: string | null;
};

export type NormalizedRentalOwnerStatement = BaseRow & {
  externalStatementId: string;
  externalUnitId: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  grossRevenue: number;
  ownerPayout: number;
  managementFees: number;
  expenses: number;
  reserveHeld: number;
};

export type NormalizedRentalExpense = BaseRow & {
  externalExpenseId: string;
  externalUnitId: string;
  kind: RentalExpenseKind;
  vendor: string | null;
  description: string | null;
  date: string | Date;
  amount: number;
};

export type NormalizedRentalMaintenanceIssue = BaseRow & {
  externalIssueId: string;
  externalUnitId: string;
  title: string;
  description: string | null;
  status: RentalIssueStatus;
  openedAt: string | Date;
  resolvedAt: string | Date | null;
  estimatedCost: number | null;
  actualCost: number | null;
  isRepeatIssue: boolean;
};

export type NormalizedRentalReview = BaseRow & {
  externalReviewId: string;
  externalUnitId: string;
  platform: string;
  rating: number | null;
  reviewText: string | null;
  reviewedAt: string | Date;
  responseHours: number | null;
};

export interface NormalizedVacationRentalImport {
  source: {
    restaurantId: string;
    kind: VacationRentalSourceKind;
    providerName: string;
  };
  batch: {
    restaurantId: string;
    sourceId: string | null;
    sourceName: string;
    rowCount: number;
    acceptedCount: number;
    rejectedCount: number;
    summary: NormalizedImportSummary;
  };
  properties: NormalizedRentalProperty[];
  bookings: NormalizedRentalBooking[];
  ownerStatements: NormalizedRentalOwnerStatement[];
  expenses: NormalizedRentalExpense[];
  maintenanceIssues: NormalizedRentalMaintenanceIssue[];
  reviews: NormalizedRentalReview[];
  rejected: string[];
}

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function money(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.round(Number(value) * 100) / 100 : 0;
}

function dateValue(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function validDate(value: string | Date | null | undefined): boolean {
  if (value == null) return false;
  return !Number.isNaN(dateValue(value).getTime());
}

function stableId(prefix: string, parts: Array<string | number | Date | null | undefined>): string {
  const basis = parts.map((part) => String(part ?? "")).join("|");
  return `${prefix}-${createHash("sha1").update(basis).digest("hex").slice(0, 16)}`;
}

function nightsBetween(checkIn: string | Date, checkOut: string | Date): number {
  const start = dateValue(checkIn).getTime();
  const end = dateValue(checkOut).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function base(context: VacationRentalImportContext, rawPayload: unknown): BaseRow {
  return {
    restaurantId: context.restaurantId,
    sourceId: context.sourceId ?? null,
    importBatchId: context.importBatchId ?? null,
    rawPayload,
  };
}

export function normalizeVacationRentalImport(
  context: VacationRentalImportContext,
  payload: VacationRentalImportPayload,
): NormalizedVacationRentalImport {
  const rejected: string[] = [];
  const knownUnitIds = new Set((payload.properties ?? []).map((property) => clean(property.externalUnitId)).filter(Boolean));
  const missingUnitReferences = new Set<string>();

  const properties: NormalizedRentalProperty[] = (payload.properties ?? []).flatMap((property) => {
    const externalUnitId = clean(property.externalUnitId);
    const name = clean(property.name);
    if (!externalUnitId || !name) {
      rejected.push(`property missing unit id or name: ${name || externalUnitId || "unknown"}`);
      return [];
    }
    return [{
      ...base(context, property.rawPayload),
      externalUnitId,
      name,
      address1: property.address1 ?? null,
      address2: property.address2 ?? null,
      city: property.city ?? null,
      state: property.state ?? null,
      postalCode: property.postalCode ?? null,
      bedrooms: property.bedrooms ?? null,
      bathrooms: property.bathrooms ?? null,
      sleeps: property.sleeps ?? null,
      active: property.active ?? true,
    }];
  });

  const bookings: NormalizedRentalBooking[] = (payload.bookings ?? []).flatMap((booking) => {
    const externalUnitId = clean(booking.externalUnitId);
    if (!externalUnitId || !validDate(booking.checkIn) || !validDate(booking.checkOut) || money(booking.grossRent) <= 0) {
      rejected.push(`booking missing unit/date/rent: ${booking.externalBookingId || externalUnitId || "unknown"}`);
      return [];
    }
    if (knownUnitIds.size > 0 && !knownUnitIds.has(externalUnitId)) missingUnitReferences.add(externalUnitId);
    const nights = booking.nights && booking.nights > 0 ? booking.nights : nightsBetween(booking.checkIn, booking.checkOut);
    return [{
      ...base(context, booking.rawPayload),
      externalBookingId: clean(booking.externalBookingId) || stableId("booking", [externalUnitId, booking.checkIn, booking.checkOut, booking.grossRent]),
      externalUnitId,
      channel: booking.channel ?? null,
      guestName: booking.guestName ?? null,
      bookedAt: booking.bookedAt ?? null,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights,
      grossRent: money(booking.grossRent),
      fees: money(booking.fees),
      taxes: money(booking.taxes),
      platformFees: money(booking.platformFees),
      ownerPayout: booking.ownerPayout == null ? null : money(booking.ownerPayout),
      status: booking.status ?? null,
    }];
  });

  const ownerStatements: NormalizedRentalOwnerStatement[] = (payload.ownerStatements ?? []).flatMap((statement) => {
    const externalUnitId = clean(statement.externalUnitId);
    if (!externalUnitId || !validDate(statement.periodStart) || !validDate(statement.periodEnd)) {
      rejected.push(`owner statement missing unit or period: ${statement.externalStatementId || externalUnitId || "unknown"}`);
      return [];
    }
    if (knownUnitIds.size > 0 && !knownUnitIds.has(externalUnitId)) missingUnitReferences.add(externalUnitId);
    return [{
      ...base(context, statement.rawPayload),
      externalStatementId: clean(statement.externalStatementId) || stableId("statement", [externalUnitId, statement.periodStart, statement.periodEnd]),
      externalUnitId,
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      grossRevenue: money(statement.grossRevenue),
      ownerPayout: money(statement.ownerPayout),
      managementFees: money(statement.managementFees),
      expenses: money(statement.expenses),
      reserveHeld: money(statement.reserveHeld),
    }];
  });

  const expenses: NormalizedRentalExpense[] = (payload.expenses ?? []).flatMap((expense) => {
    const externalUnitId = clean(expense.externalUnitId);
    if (!externalUnitId || !validDate(expense.date) || money(expense.amount) <= 0) {
      rejected.push(`expense missing unit/date/amount: ${expense.externalExpenseId || externalUnitId || "unknown"}`);
      return [];
    }
    if (knownUnitIds.size > 0 && !knownUnitIds.has(externalUnitId)) missingUnitReferences.add(externalUnitId);
    return [{
      ...base(context, expense.rawPayload),
      externalExpenseId: clean(expense.externalExpenseId) || stableId("expense", [externalUnitId, expense.date, expense.amount, expense.description]),
      externalUnitId,
      kind: expense.kind ?? "OTHER",
      vendor: expense.vendor ?? null,
      description: expense.description ?? null,
      date: expense.date,
      amount: money(expense.amount),
    }];
  });

  const maintenanceIssues: NormalizedRentalMaintenanceIssue[] = (payload.maintenanceIssues ?? []).flatMap((issue) => {
    const externalUnitId = clean(issue.externalUnitId);
    const title = clean(issue.title);
    if (!externalUnitId || !title || !validDate(issue.openedAt)) {
      rejected.push(`maintenance issue missing unit/title/open date: ${issue.externalIssueId || externalUnitId || "unknown"}`);
      return [];
    }
    if (knownUnitIds.size > 0 && !knownUnitIds.has(externalUnitId)) missingUnitReferences.add(externalUnitId);
    return [{
      ...base(context, issue.rawPayload),
      externalIssueId: clean(issue.externalIssueId) || stableId("issue", [externalUnitId, issue.openedAt, title]),
      externalUnitId,
      title,
      description: issue.description ?? null,
      status: issue.status ?? "OPEN",
      openedAt: issue.openedAt,
      resolvedAt: issue.resolvedAt ?? null,
      estimatedCost: issue.estimatedCost == null ? null : money(issue.estimatedCost),
      actualCost: issue.actualCost == null ? null : money(issue.actualCost),
      isRepeatIssue: issue.isRepeatIssue ?? false,
    }];
  });

  const reviews: NormalizedRentalReview[] = (payload.reviews ?? []).flatMap((review) => {
    const externalUnitId = clean(review.externalUnitId);
    const platform = clean(review.platform);
    if (!externalUnitId || !platform || !validDate(review.reviewedAt)) {
      rejected.push(`review missing unit/platform/date: ${review.externalReviewId || externalUnitId || "unknown"}`);
      return [];
    }
    if (knownUnitIds.size > 0 && !knownUnitIds.has(externalUnitId)) missingUnitReferences.add(externalUnitId);
    return [{
      ...base(context, review.rawPayload),
      externalReviewId: clean(review.externalReviewId) || stableId("review", [externalUnitId, platform, review.reviewedAt, review.rating]),
      externalUnitId,
      platform,
      rating: review.rating ?? null,
      reviewText: review.reviewText ?? null,
      reviewedAt: review.reviewedAt,
      responseHours: review.responseHours ?? null,
    }];
  });

  const summary: NormalizedImportSummary = {
    properties: properties.length,
    bookings: bookings.length,
    ownerStatements: ownerStatements.length,
    expenses: expenses.length,
    maintenanceIssues: maintenanceIssues.length,
    reviews: reviews.length,
    accepted: properties.length + bookings.length + ownerStatements.length + expenses.length + maintenanceIssues.length + reviews.length,
    rejected: rejected.length,
    missingUnitReferences: Array.from(missingUnitReferences).sort(),
  };

  return {
    source: {
      restaurantId: context.restaurantId,
      kind: context.sourceKind,
      providerName: context.sourceName,
    },
    batch: {
      restaurantId: context.restaurantId,
      sourceId: context.sourceId ?? null,
      sourceName: context.sourceName,
      rowCount: summary.accepted + summary.rejected,
      acceptedCount: summary.accepted,
      rejectedCount: summary.rejected,
      summary,
    },
    properties,
    bookings,
    ownerStatements,
    expenses,
    maintenanceIssues,
    reviews,
    rejected,
  };
}
