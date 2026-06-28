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

## Meeting Demo Readiness

Target: show a grounded real estate brokerage heartbeat in roughly 1.5 weeks.

### Must Be Clear In The Demo

- Company Dollar is GCI minus agent splits, referral fees, franchise fees, and other pass-throughs.
- Split pressure shows how much GCI is being consumed by agent payouts and cap timing.
- Cap remaining should be adjustable per agent during setup.
- Break-even should be expressed in Company Dollar needed before profit starts, not simply gross commission.
- Pipeline should show probability-weighted Company Dollar by expected close window.
- Consultants/accountants should be able to adjust assumptions without owning sensitive API authorization.
- Users should see what they can manipulate to affect outcomes: splits, caps, fixed OpEx, referral/franchise fees, lead spend, close probability, and expected close date.

### Demo Modules To Finalize

1. Company Dollar
   - Shows retained brokerage revenue after pass-throughs.
   - Needs agent/deal split assumptions and brokerage fees.

2. Split / Cap Pressure
   - Shows whether agent payouts are compressing brokerage margin.
   - Needs per-agent split percentage, cap amount, cap paid, and cap remaining.

3. Commission Pipeline
   - Shows pending and probability-weighted Company Dollar.
   - Needs expected close date, stage, GCI, payout, and probability.

4. Agent Performance
   - Shows Company Dollar by agent, cap progress, and pipeline contribution.
   - Needs roster, closed deals, pending deals, and lead/source tags.

5. Lead ROI
   - Shows lead spend compared with retained Company Dollar.
   - Needs lead source spend and attributed deals.

6. Market Aura
   - Shows market energy from listings, pendings, DOM, price drops, rates, showings, and Google intent.
   - Can use fictional sample data for the meeting demo.

7. Break-even Company Dollar
   - Shows retained Company Dollar needed to cover fixed brokerage expenses before profit starts.
   - Needs monthly fixed OpEx and optional owner pay/profit targets.

## Minimum Pilot Data

- Agent roster
- Closed deals for 6-12 months
- Pending pipeline
- Split/cap rules
- Monthly brokerage OpEx

## Recommended Build Order

1. Finish realistic fictional sample data and tile explanations for the public real estate tour.
2. Ensure real estate dashboard screens contain no restaurant/demo-bistro language.
3. Add setup/adjustment UI for per-agent splits, caps, fixed OpEx, and pipeline assumptions.
4. Add database tables for agents, deals, lead spend, and market metrics.
5. Add JSON import preview/commit APIs, matching the rental import pattern.
6. Add a brokerage import page.
7. Replace the brokerage demo sample rows with imported data when available.
8. Add MLS/RESO and back-office connectors later.
