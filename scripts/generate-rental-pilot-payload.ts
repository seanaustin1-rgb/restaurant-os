import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const propertyCount = Number(process.argv.find((arg) => arg.startsWith("--properties="))?.split("=")[1] ?? 1000);
const annualBookings = Number(process.argv.find((arg) => arg.startsWith("--bookings="))?.split("=")[1] ?? 14000);
const outArg = process.argv.find((arg) => arg.startsWith("--out="))?.split("=")[1];
const outPath = outArg ?? join("tmp", "rental-pilot-payload.json");

function dollars(value: number): number {
  return Math.round(value * 100) / 100;
}

function date(dayOffset: number): string {
  const d = new Date(Date.UTC(2026, 0, 1 + dayOffset));
  return d.toISOString().slice(0, 10);
}

const properties = Array.from({ length: propertyCount }, (_, i) => {
  const n = i + 1;
  return {
    externalUnitId: `unit_${String(n).padStart(4, "0")}`,
    name: `Pilot Property ${String(n).padStart(4, "0")}`,
    city: n % 3 === 0 ? "Ocean City" : n % 3 === 1 ? "York" : "Lancaster",
    state: n % 3 === 0 ? "MD" : "PA",
    bedrooms: 1 + (n % 5),
    bathrooms: 1 + (n % 4) * 0.5,
    sleeps: 2 + (n % 8),
  };
});

const bookings = Array.from({ length: annualBookings }, (_, i) => {
  const n = i + 1;
  const unit = properties[i % properties.length];
  const nights = 2 + (i % 6);
  const checkInOffset = i % 365;
  const adr = 155 + ((i * 17) % 310);
  const grossRent = dollars(adr * nights);
  return {
    externalBookingId: `booking_${String(n).padStart(6, "0")}`,
    externalUnitId: unit.externalUnitId,
    channel: i % 5 === 0 ? "Direct" : i % 5 === 1 ? "Vrbo" : "Airbnb",
    checkIn: date(checkInOffset),
    checkOut: date(checkInOffset + nights),
    nights,
    grossRent,
    fees: dollars(grossRent * 0.08),
    taxes: dollars(grossRent * 0.06),
    platformFees: dollars(grossRent * (i % 5 === 0 ? 0.01 : 0.035)),
    ownerPayout: dollars(grossRent * 0.58),
    status: "confirmed",
  };
});

const ownerStatements = properties.map((property, i) => {
  const unitBookings = bookings.filter((booking) => booking.externalUnitId === property.externalUnitId).slice(0, 6);
  const grossRevenue = dollars(unitBookings.reduce((sum, booking) => sum + booking.grossRent + booking.fees, 0));
  return {
    externalStatementId: `statement_${property.externalUnitId}_2026_01`,
    externalUnitId: property.externalUnitId,
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    grossRevenue,
    ownerPayout: dollars(grossRevenue * 0.58),
    managementFees: dollars(grossRevenue * 0.18),
    expenses: dollars(250 + (i % 9) * 75),
    reserveHeld: dollars(grossRevenue * 0.08),
  };
});

const expenses = properties.flatMap((property, i) => [
  {
    externalExpenseId: `cleaning_${property.externalUnitId}_2026_01`,
    externalUnitId: property.externalUnitId,
    kind: "CLEANING",
    vendor: "Pilot Cleaning",
    description: "January turns",
    date: "2026-01-31",
    amount: dollars(180 + (i % 6) * 35),
  },
  {
    externalExpenseId: `maintenance_${property.externalUnitId}_2026_01`,
    externalUnitId: property.externalUnitId,
    kind: "MAINTENANCE",
    vendor: "Pilot Maintenance",
    description: i % 7 === 0 ? "Repeat repair" : "Routine repair",
    date: "2026-01-20",
    amount: dollars(i % 7 === 0 ? 650 : 125 + (i % 5) * 40),
  },
]);

const maintenanceIssues = properties
  .filter((_, i) => i % 4 === 0)
  .map((property, i) => ({
    externalIssueId: `issue_${property.externalUnitId}_2026_01`,
    externalUnitId: property.externalUnitId,
    title: i % 7 === 0 ? "Repeat HVAC complaint" : "Maintenance follow-up",
    status: i % 5 === 0 ? "OPEN" : "RESOLVED",
    openedAt: "2026-01-18T12:00:00.000Z",
    resolvedAt: i % 5 === 0 ? null : "2026-01-21T12:00:00.000Z",
    estimatedCost: dollars(i % 7 === 0 ? 650 : 225),
    actualCost: dollars(i % 5 === 0 ? 0 : i % 7 === 0 ? 700 : 240),
    isRepeatIssue: i % 7 === 0,
  }));

const reviews = properties
  .filter((_, i) => i % 2 === 0)
  .map((property, i) => ({
    externalReviewId: `review_${property.externalUnitId}_2026_01`,
    externalUnitId: property.externalUnitId,
    platform: i % 3 === 0 ? "Google" : "Airbnb",
    rating: dollars(3.8 + (i % 12) * 0.1),
    reviewText: "Pilot sample guest feedback",
    reviewedAt: "2026-01-28",
    responseHours: i % 9 === 0 ? 24 : 4 + (i % 5),
  }));

const payload = { properties, bookings, ownerStatements, expenses, maintenanceIssues, reviews };

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(payload, null, 2));

console.log(JSON.stringify({
  outPath,
  properties: properties.length,
  bookings: bookings.length,
  ownerStatements: ownerStatements.length,
  expenses: expenses.length,
  maintenanceIssues: maintenanceIssues.length,
  reviews: reviews.length,
}, null, 2));
