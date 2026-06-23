# Vacation Rental Pilot Checklist

Purpose: prepare a property-management pilot before API access or exports are finalized. The goal is to prove that OutFront can turn rental operations data into a useful portfolio heartbeat, owner proceeds read, guest Aura, and action queue.

## Minimum Useful Data

Ask for these first. They are enough to produce a meaningful property heartbeat.

1. Property list
   - Unit/property ID
   - Property name
   - City/state
   - Bedrooms, bathrooms, sleeps, active/inactive

2. Booking history
   - Booking/reservation ID
   - Unit/property ID
   - Channel
   - Check-in/check-out
   - Gross rent
   - Fees, taxes, platform fees
   - Owner payout if available

3. Owner statements
   - Statement ID or period
   - Unit/property ID
   - Period start/end
   - Gross revenue
   - Owner payout
   - Management fees
   - Expenses/reserve held

4. Maintenance or work orders
   - Issue/work order ID
   - Unit/property ID
   - Title/status
   - Opened/resolved date
   - Estimated/actual cost
   - Repeat issue flag if available

5. Reviews or feedback
   - Review ID
   - Unit/property ID
   - Platform
   - Rating
   - Review date
   - Response time if available

## Nice To Have

- Cleaning/turn cost detail
- Housekeeping completion dates
- Rate table and restrictions
- Future availability
- Channel source detail
- Direct-booking vs OTA split
- Owner reserve targets
- Complaint categories

## What Each File Proves

- Property list: whether every operational record can attach to a property.
- Bookings: occupancy, ADR, RevPAR, booking pace, revenue base.
- Owner statements: owner proceeds and profitability confidence.
- Expenses: maintenance drag and unit-level operating cost.
- Maintenance: open issues, repeat issues, property pressure.
- Reviews: guest Aura and response quality.

## Pilot Acceptance Criteria

- At least 95% of bookings attach to a known property.
- At least 80% of active properties have either bookings or statements.
- Expenses can be tied to properties, not only portfolio-level totals.
- Maintenance issues include open/resolved status.
- Reviews include property ID or a reliable matching field.
- The portfolio rollup identifies top pressure properties without manual sorting.

## First Conversation Script

The clean ask:

"Can you export a property list, recent bookings, owner statements, maintenance/work orders, and reviews/guest feedback for a small pilot sample? We do not need API access yet. A few months of history is enough. The most important field is the property/unit ID, because that lets us connect money, bookings, issues, and reviews to the same house."

## Pilot Scale Target

Use a small first upload, then expand.

- First upload: 25-50 properties, 60-90 days of history.
- Second upload: 100-250 properties, 6 months of history.
- Scale test: 1,000 properties and roughly 14,000 annual bookings.
