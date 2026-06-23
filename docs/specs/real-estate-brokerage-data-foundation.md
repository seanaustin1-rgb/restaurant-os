# Real Estate Brokerage Data Foundation

Purpose: define the first live-data model for the brokerage module before MLS or back-office API access is available.

## Core Objects

1. Agent
   - Agent ID
   - Name
   - Status
   - Default split percentage
   - Annual cap amount
   - Cap paid/remaining

2. Deal
   - Deal ID
   - Agent ID
   - Address or deal label
   - Stage
   - Expected close date
   - Closed date
   - Sale price
   - GCI
   - Referral fee
   - Franchise fee
   - Agent payout
   - Company Dollar

3. Lead Spend
   - Agent ID
   - Source
   - Period
   - Spend
   - Attributed deals or GCI

4. Market Metric
   - Market
   - Date
   - New listings
   - Pendings
   - Closed sales
   - Average DOM
   - Price reductions
   - Showing appointments
   - Mortgage rate
   - Google intent trend

## First Useful Reports

- Company Dollar by agent
- Split/cap pressure
- Pending Company Dollar pipeline
- Lead ROI by agent/source
- Market Aura by market
- Break-even Company Dollar needed before profit starts

## Minimum Pilot Data

- Agent roster
- Closed deals for 6-12 months
- Pending pipeline
- Split/cap rules
- Monthly brokerage OpEx

## Recommended Build Order

1. Add database tables for agents, deals, lead spend, and market metrics.
2. Add JSON import preview/commit APIs, matching the rental import pattern.
3. Add a brokerage import page.
4. Replace the brokerage demo sample rows with imported data.
5. Add MLS/RESO and back-office connectors later.
