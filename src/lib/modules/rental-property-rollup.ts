import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computePropertyPortfolio, type PropertyPortfolioResult } from "@/lib/demo/property-portfolio";
import type { PropertyHeartbeatInput } from "@/lib/demo/property-heartbeat";

const n = (value: unknown): number => (value == null ? 0 : Number(value));

function monthWindow(ref: Date): { start: Date; end: Date; days: number } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / 86_400_000) };
}

function maxDate(dates: Array<Date | null | undefined>): Date {
  const found = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (found.length === 0) return new Date();
  return new Date(Math.max(...found.map((date) => date.getTime())));
}

export interface RentalPropertyRollupData {
  periodLabel: string;
  hasImportedRentalData: boolean;
  portfolio: PropertyPortfolioResult | null;
}

export async function loadRentalPropertyRollup(
  restaurantId: string,
  db: PrismaClient = prisma,
): Promise<RentalPropertyRollupData> {
  const [latestBooking, latestStatement, latestExpense, latestIssue, latestReview] = await Promise.all([
    db.rentalBooking.findFirst({ where: { restaurantId }, orderBy: { checkIn: "desc" }, select: { checkIn: true } }),
    db.rentalOwnerStatement.findFirst({ where: { restaurantId }, orderBy: { periodEnd: "desc" }, select: { periodEnd: true } }),
    db.rentalExpense.findFirst({ where: { restaurantId }, orderBy: { date: "desc" }, select: { date: true } }),
    db.rentalMaintenanceIssue.findFirst({ where: { restaurantId }, orderBy: { openedAt: "desc" }, select: { openedAt: true } }),
    db.rentalReview.findFirst({ where: { restaurantId }, orderBy: { reviewedAt: "desc" }, select: { reviewedAt: true } }),
  ]);
  const ref = maxDate([
    latestBooking?.checkIn,
    latestStatement?.periodEnd,
    latestExpense?.date,
    latestIssue?.openedAt,
    latestReview?.reviewedAt,
  ]);
  const { start, end, days } = monthWindow(ref);
  const futureStart = new Date();
  const futureEnd = new Date(futureStart.getTime() + 30 * 86_400_000);

  const properties = await db.rentalProperty.findMany({
    where: { restaurantId, active: true },
    include: {
      bookings: {
        where: {
          OR: [
            { checkIn: { gte: start, lt: end } },
            { checkIn: { gte: futureStart, lt: futureEnd } },
          ],
        },
      },
      ownerStatements: { where: { periodEnd: { gte: start, lt: end } } },
      expenses: { where: { date: { gte: start, lt: end } } },
      maintenanceIssues: {
        where: {
          OR: [
            { openedAt: { gte: start, lt: end } },
            { status: { in: ["OPEN", "IN_PROGRESS"] } },
          ],
        },
      },
      reviews: { where: { reviewedAt: { gte: start, lt: end } } },
    },
    orderBy: { name: "asc" },
  });

  const inputs: PropertyHeartbeatInput[] = properties.map((property) => {
    const periodBookings = property.bookings.filter((booking) => booking.checkIn >= start && booking.checkIn < end);
    const futureBookings = property.bookings.filter((booking) => booking.checkIn >= futureStart && booking.checkIn < futureEnd);
    const statementRevenue = property.ownerStatements.reduce((sum, statement) => sum + n(statement.grossRevenue), 0);
    const bookingRevenue = periodBookings.reduce((sum, booking) => sum + n(booking.grossRent) + n(booking.fees), 0);
    const monthlyBookingRevenue = statementRevenue > 0 ? statementRevenue : bookingRevenue;
    const bookedNights = periodBookings.reduce((sum, booking) => sum + booking.nights, 0);
    const futureBookedNights = futureBookings.reduce((sum, booking) => sum + booking.nights, 0);
    const cleaningCosts = property.expenses
      .filter((expense) => expense.kind === "CLEANING")
      .reduce((sum, expense) => sum + n(expense.amount), 0);
    const maintenanceExpenses = property.expenses
      .filter((expense) => expense.kind === "MAINTENANCE")
      .reduce((sum, expense) => sum + n(expense.amount), 0);
    const maintenanceIssueCosts = property.maintenanceIssues.reduce(
      (sum, issue) => sum + n(issue.actualCost ?? issue.estimatedCost),
      0,
    );
    const platformFees =
      periodBookings.reduce((sum, booking) => sum + n(booking.platformFees), 0) +
      property.expenses.filter((expense) => expense.kind === "PLATFORM_FEE").reduce((sum, expense) => sum + n(expense.amount), 0);
    const managementFees = property.ownerStatements.reduce((sum, statement) => sum + n(statement.managementFees), 0);
    const managementFeePct = monthlyBookingRevenue > 0 ? (managementFees / monthlyBookingRevenue) * 100 : 18;
    const reviewCount = property.reviews.length;
    const reviewRating =
      reviewCount > 0 ? property.reviews.reduce((sum, review) => sum + n(review.rating), 0) / reviewCount : 4.5;
    const responses = property.reviews.map((review) => n(review.responseHours)).filter((value) => value > 0);
    const avgResponseHours = responses.length > 0 ? responses.reduce((sum, value) => sum + value, 0) / responses.length : 12;
    const openIssues = property.maintenanceIssues.filter((issue) => issue.status === "OPEN" || issue.status === "IN_PROGRESS").length;

    return {
      name: property.name,
      monthlyBookingRevenue,
      occupancyPct: days > 0 ? Math.min(100, (bookedNights / days) * 100) : 0,
      averageDailyRate: bookedNights > 0 ? bookingRevenue / bookedNights : 0,
      cleaningCosts,
      maintenanceCosts: maintenanceExpenses + maintenanceIssueCosts,
      platformFees,
      managementFeePct,
      ownerReserveTarget: Math.max(
        monthlyBookingRevenue * 0.25,
        property.ownerStatements.reduce((sum, statement) => sum + n(statement.reserveHeld), 0),
      ),
      openIssues,
      repeatIssues: property.maintenanceIssues.filter((issue) => issue.isRepeatIssue).length,
      avgResponseHours,
      reviewRating,
      futureBookedNights,
      next30AvailableNights: 30,
    };
  });

  const portfolio = inputs.length > 0 ? computePropertyPortfolio(inputs) : null;
  return {
    periodLabel: `${ref.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${ref.getUTCFullYear()} rental MTD`,
    hasImportedRentalData: inputs.length > 0,
    portfolio,
  };
}
