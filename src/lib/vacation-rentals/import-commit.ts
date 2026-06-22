import { Prisma, type PrismaClient, type VacationRentalSourceKind } from "@prisma/client";
import {
  normalizeVacationRentalImport,
  type VacationRentalImportPayload,
} from "./normalized-import";

export interface CommitVacationRentalImportInput {
  restaurantId: string;
  importedBy?: string | null;
  sourceName: string;
  sourceKind: VacationRentalSourceKind;
  fileName?: string | null;
  externalAccountId?: string | null;
  payload: VacationRentalImportPayload;
}

export interface CommitVacationRentalImportResult {
  sourceId: string;
  batchId: string;
  summary: {
    properties: number;
    bookings: number;
    ownerStatements: number;
    expenses: number;
    maintenanceIssues: number;
    reviews: number;
    accepted: number;
    rejected: number;
    missingUnitReferences: string[];
  };
  rejected: string[];
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  if (value == null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function date(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function commitVacationRentalImport(
  db: PrismaClient,
  input: CommitVacationRentalImportInput,
): Promise<CommitVacationRentalImportResult> {
  const source = await db.vacationRentalSource.upsert({
    where: {
      restaurantId_kind_providerName_externalAccountId: {
        restaurantId: input.restaurantId,
        kind: input.sourceKind,
        providerName: input.sourceName,
        externalAccountId: input.externalAccountId ?? "",
      },
    },
    create: {
      restaurantId: input.restaurantId,
      kind: input.sourceKind,
      providerName: input.sourceName,
      externalAccountId: input.externalAccountId ?? "",
      displayName: input.sourceName,
    },
    update: {
      displayName: input.sourceName,
      isActive: true,
      lastSyncedAt: new Date(),
    },
  });

  const staged = normalizeVacationRentalImport(
    {
      restaurantId: input.restaurantId,
      sourceId: source.id,
      sourceName: input.sourceName,
      sourceKind: input.sourceKind,
    },
    input.payload,
  );

  const batch = await db.vacationRentalImportBatch.create({
    data: {
      restaurantId: input.restaurantId,
      sourceId: source.id,
      sourceName: input.sourceName,
      importedBy: input.importedBy ?? null,
      fileName: input.fileName ?? null,
      rowCount: staged.batch.rowCount,
      acceptedCount: staged.batch.acceptedCount,
      rejectedCount: staged.batch.rejectedCount,
      summary: json(staged.batch.summary),
    },
  });

  const normalized = normalizeVacationRentalImport(
    {
      restaurantId: input.restaurantId,
      sourceId: source.id,
      importBatchId: batch.id,
      sourceName: input.sourceName,
      sourceKind: input.sourceKind,
    },
    input.payload,
  );

  for (const property of normalized.properties) {
    await db.rentalProperty.upsert({
      where: {
        restaurantId_externalUnitId: {
          restaurantId: input.restaurantId,
          externalUnitId: property.externalUnitId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        sourceId: source.id,
        importBatchId: batch.id,
        externalUnitId: property.externalUnitId,
        name: property.name,
        address1: property.address1,
        address2: property.address2,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sleeps: property.sleeps,
        active: property.active,
        rawPayload: json(property.rawPayload),
      },
      update: {
        sourceId: source.id,
        importBatchId: batch.id,
        name: property.name,
        address1: property.address1,
        address2: property.address2,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        sleeps: property.sleeps,
        active: property.active,
        rawPayload: json(property.rawPayload),
      },
    });
  }

  const properties = await db.rentalProperty.findMany({
    where: {
      restaurantId: input.restaurantId,
      externalUnitId: {
        in: Array.from(
          new Set([
            ...normalized.properties.map((row) => row.externalUnitId),
            ...normalized.bookings.map((row) => row.externalUnitId),
            ...normalized.ownerStatements.map((row) => row.externalUnitId),
            ...normalized.expenses.map((row) => row.externalUnitId),
            ...normalized.maintenanceIssues.map((row) => row.externalUnitId),
            ...normalized.reviews.map((row) => row.externalUnitId),
          ]),
        ),
      },
    },
    select: { id: true, externalUnitId: true },
  });
  const propertyIdByUnit = new Map(properties.map((property) => [property.externalUnitId, property.id]));

  for (const booking of normalized.bookings) {
    await db.rentalBooking.upsert({
      where: {
        restaurantId_externalBookingId: {
          restaurantId: input.restaurantId,
          externalBookingId: booking.externalBookingId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        propertyId: propertyIdByUnit.get(booking.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        externalBookingId: booking.externalBookingId,
        externalUnitId: booking.externalUnitId,
        channel: booking.channel,
        guestName: booking.guestName,
        bookedAt: booking.bookedAt == null ? null : date(booking.bookedAt),
        checkIn: date(booking.checkIn),
        checkOut: date(booking.checkOut),
        nights: booking.nights,
        grossRent: booking.grossRent,
        fees: booking.fees,
        taxes: booking.taxes,
        platformFees: booking.platformFees,
        ownerPayout: booking.ownerPayout,
        status: booking.status,
        rawPayload: json(booking.rawPayload),
      },
      update: {
        propertyId: propertyIdByUnit.get(booking.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        channel: booking.channel,
        guestName: booking.guestName,
        bookedAt: booking.bookedAt == null ? null : date(booking.bookedAt),
        checkIn: date(booking.checkIn),
        checkOut: date(booking.checkOut),
        nights: booking.nights,
        grossRent: booking.grossRent,
        fees: booking.fees,
        taxes: booking.taxes,
        platformFees: booking.platformFees,
        ownerPayout: booking.ownerPayout,
        status: booking.status,
        rawPayload: json(booking.rawPayload),
      },
    });
  }

  for (const statement of normalized.ownerStatements) {
    await db.rentalOwnerStatement.upsert({
      where: {
        restaurantId_externalStatementId: {
          restaurantId: input.restaurantId,
          externalStatementId: statement.externalStatementId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        propertyId: propertyIdByUnit.get(statement.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        externalStatementId: statement.externalStatementId,
        externalUnitId: statement.externalUnitId,
        periodStart: date(statement.periodStart),
        periodEnd: date(statement.periodEnd),
        grossRevenue: statement.grossRevenue,
        ownerPayout: statement.ownerPayout,
        managementFees: statement.managementFees,
        expenses: statement.expenses,
        reserveHeld: statement.reserveHeld,
        rawPayload: json(statement.rawPayload),
      },
      update: {
        propertyId: propertyIdByUnit.get(statement.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        periodStart: date(statement.periodStart),
        periodEnd: date(statement.periodEnd),
        grossRevenue: statement.grossRevenue,
        ownerPayout: statement.ownerPayout,
        managementFees: statement.managementFees,
        expenses: statement.expenses,
        reserveHeld: statement.reserveHeld,
        rawPayload: json(statement.rawPayload),
      },
    });
  }

  for (const expense of normalized.expenses) {
    await db.rentalExpense.upsert({
      where: {
        restaurantId_externalExpenseId: {
          restaurantId: input.restaurantId,
          externalExpenseId: expense.externalExpenseId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        propertyId: propertyIdByUnit.get(expense.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        externalExpenseId: expense.externalExpenseId,
        externalUnitId: expense.externalUnitId,
        kind: expense.kind,
        vendor: expense.vendor,
        description: expense.description,
        date: date(expense.date),
        amount: expense.amount,
        rawPayload: json(expense.rawPayload),
      },
      update: {
        propertyId: propertyIdByUnit.get(expense.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        kind: expense.kind,
        vendor: expense.vendor,
        description: expense.description,
        date: date(expense.date),
        amount: expense.amount,
        rawPayload: json(expense.rawPayload),
      },
    });
  }

  for (const issue of normalized.maintenanceIssues) {
    await db.rentalMaintenanceIssue.upsert({
      where: {
        restaurantId_externalIssueId: {
          restaurantId: input.restaurantId,
          externalIssueId: issue.externalIssueId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        propertyId: propertyIdByUnit.get(issue.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        externalIssueId: issue.externalIssueId,
        externalUnitId: issue.externalUnitId,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        openedAt: date(issue.openedAt),
        resolvedAt: issue.resolvedAt == null ? null : date(issue.resolvedAt),
        estimatedCost: issue.estimatedCost,
        actualCost: issue.actualCost,
        isRepeatIssue: issue.isRepeatIssue,
        rawPayload: json(issue.rawPayload),
      },
      update: {
        propertyId: propertyIdByUnit.get(issue.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        openedAt: date(issue.openedAt),
        resolvedAt: issue.resolvedAt == null ? null : date(issue.resolvedAt),
        estimatedCost: issue.estimatedCost,
        actualCost: issue.actualCost,
        isRepeatIssue: issue.isRepeatIssue,
        rawPayload: json(issue.rawPayload),
      },
    });
  }

  for (const review of normalized.reviews) {
    await db.rentalReview.upsert({
      where: {
        restaurantId_externalReviewId: {
          restaurantId: input.restaurantId,
          externalReviewId: review.externalReviewId,
        },
      },
      create: {
        restaurantId: input.restaurantId,
        propertyId: propertyIdByUnit.get(review.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        externalReviewId: review.externalReviewId,
        externalUnitId: review.externalUnitId,
        platform: review.platform,
        rating: review.rating,
        reviewText: review.reviewText,
        reviewedAt: date(review.reviewedAt),
        responseHours: review.responseHours,
        rawPayload: json(review.rawPayload),
      },
      update: {
        propertyId: propertyIdByUnit.get(review.externalUnitId) ?? null,
        sourceId: source.id,
        importBatchId: batch.id,
        platform: review.platform,
        rating: review.rating,
        reviewText: review.reviewText,
        reviewedAt: date(review.reviewedAt),
        responseHours: review.responseHours,
        rawPayload: json(review.rawPayload),
      },
    });
  }

  await db.vacationRentalImportBatch.update({
    where: { id: batch.id },
    data: {
      status: "COMMITTED",
      committedAt: new Date(),
      rowCount: normalized.batch.rowCount,
      acceptedCount: normalized.batch.acceptedCount,
      rejectedCount: normalized.batch.rejectedCount,
      summary: json(normalized.batch.summary),
    },
  });

  return {
    sourceId: source.id,
    batchId: batch.id,
    summary: normalized.batch.summary,
    rejected: normalized.rejected,
  };
}
