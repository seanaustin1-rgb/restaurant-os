# PRD: Heartbeat, Go-Live Readiness, and Aura Market Energy

**Status:** Draft
**Owner:** Operator / Customer Zero
**Date:** 2026-06-21
**Component:** Restaurant OS / OutFront Data - Profit First operating layer

---

## Problem Statement

Restaurant operators often do not know the current health of the business until after the month closes, when the damage is already done. They also tend to manage cash by checking whether money exists in the account, instead of assigning every dollar a job before it gets spent. OutFront should become the real-time business heartbeat: it connects the back-office stack, shows what is happening now, simulates Profit First cash discipline, coaches the operator toward safer cash control, and eventually enforces real money movement when the business is ready.

## Product Thesis

OutFront is not only a dashboard. It is a progression from visibility to discipline:

1. **Observe** - connect the business stack and show the heartbeat.
2. **Simulate** - run Profit First virtually against real sales, bank, POS, and expense activity.
3. **Coach** - explain where the model would break and what the operator can safely improve.
4. **Pilot** - move only selected buckets or require approval before transfers.
5. **Enforce** - automate real account routing once the business is ready.

The app should answer one core question:

> Is the business getting stronger, weaker, or unstable right now, and what should happen to the next dollar?

## Goals

1. **Make the heartbeat visible daily.** Operators, advisors, and investors should see current cash, sales, cost, reputation, and customer-intent signals without waiting for month-end.
2. **Turn Profit First into a diagnostic engine.** The app should show what should have happened to each dollar, what actually happened, and where the business would have gone short.
3. **Create a safe path to real cash movement.** Go-live should be a second onboarding flow that starts with readiness, then optional partial activation, then full automation.
4. **Make Aura a market-energy signal.** Aura should measure customer opinion plus customer intent: ratings, reviews, review velocity, calls, direction requests, website clicks, and eventually review themes.
5. **Support advisor and investor use cases.** Accountants and investors should be able to monitor many companies and know where to praise, intervene, or require tighter controls.

## Non-Goals

- **No real-money movement in v1 of this spec.** The first build should remain virtual and advisory. Actual ACH/account movement belongs to Pilot/Enforce after legal, compliance, and banking design.
- **No full bookkeeping replacement.** OutFront is an operating heartbeat and Profit First control layer, not a general ledger or tax-prep system.
- **No fully automated investor repayment in the first slice.** Investor Return should be modeled as a future lane, but not moved automatically until the cash rules and agreements are explicit.
- **No claim that static benchmarks are live peer data.** Benchmarks remain transparent industry guide rails until anonymized cohort data exists.
- **No overreach on Google data availability.** Business Profile action metrics depend on API access and permissions; the UI must gracefully handle missing sources.

## Personas

### Operator

Needs to know what is happening today, where cash is leaking, and whether the business can safely protect profit, taxes, owner pay, and operating buckets.

### Accountant / Advisor

Needs to watch many client heartbeats and reach out in real time: "good job," "watch labor," "tax reserve is short," or "you are ready to pilot Profit."

### Investor / Capital Partner

Needs transparent, current visibility into whether the company is healthy, whether capital is being protected, and whether agreed repayment/profit-sharing lanes are being honored.

## User Stories

### Operator

- As an operator, I want to see a daily heartbeat score so I know whether the business is stable, improving, or under pressure.
- As an operator, I want the app to simulate Profit First against actual sales and expenses so I can understand what each dollar should have done.
- As an operator, I want to see where the virtual model would have gone short so I can adjust spending, labor, prices, or targets before real money starts moving.
- As an operator, I want a recommended partial go-live plan so I can begin with the safest buckets instead of flipping the whole system on at once.
- As an operator, I want Aura to show customer interest and reputation together so I know whether outside demand is helping or hurting future revenue.

### Accountant / Advisor

- As an advisor, I want to see which clients are drifting from their cash plan so I can intervene before month-end.
- As an advisor, I want to compare simulated Profit First buckets against actual cash behavior so I can coach clients with specifics.
- As an advisor, I want readiness stages so I can recommend when a client should start protecting tax, profit, owner pay, or full allocation.

### Investor

- As an investor, I want a current heartbeat view so I can monitor the business without waiting for quarterly reporting.
- As an investor, I want investor return modeled as a lane so repayment expectations are visible and eventually enforceable.
- As an investor, I want alerts when cash behavior threatens tax, payroll, profit, or investor obligations.

## Requirements

### P0 - Go-Live Readiness Coach

1. **Readiness stages**
   - The system must classify each restaurant into one of: Observe, Simulate, Coach, Pilot Ready, Full Go-Live Ready.
   - Acceptance criteria:
     - Given a restaurant with connected data but insufficient history, the system reports Observe or Simulate.
     - Given a restaurant with stable data and bucket coverage, the system reports which pilot buckets are safe.

2. **Virtual allocation replay**
   - The system must calculate what Profit First allocations should have happened for a selected period using actual sales and target percentages.
   - Acceptance criteria:
     - Given recent Toast sales, the system computes virtual inflows by bucket.
     - Given actual bank expenses, the system compares spending against virtual bucket capacity.

3. **Shortfall detection**
   - The system must identify buckets that would have gone negative or could not be fully funded.
   - Acceptance criteria:
     - Given labor spending above target, the system reports the dollar shortfall and the bucket being starved.
     - Given tax reserve obligations above available reserve, the system flags Tax Reserve as not ready.

4. **Recommended pilot plan**
   - The system must recommend a first partial activation path.
   - Initial assumption:
     - Start with Tax Reserve and Profit before broader buckets.
   - Acceptance criteria:
     - Given sufficient tax coverage but unstable OpEx, the system recommends "Tax Reserve only" or "Tax Reserve + small Profit skim."
     - Given unstable cash flow, the system recommends staying virtual.

5. **Operator-language explanations**
   - Results must be written in plain language, not accounting jargon.
   - Example outputs:
     - "You can protect tax, but not profit yet."
     - "Labor is consuming dollars that should become owner pay."
     - "Recommended pilot: Tax Reserve at 100% and Profit at 1% for 30 days."

### P0 - Aura Market Energy v1

1. **Rating and review trend**
   - Continue weekly reputation snapshots and show latest vs. prior-period change.

2. **Review velocity**
   - Show whether review count is growing, flat, or slowing.

3. **Customer-intent metric placeholders**
   - Add the data model and UI slots for Google Business Profile actions:
     - Website clicks
     - Direction requests
     - Phone calls
     - Profile/search views, if available
   - Acceptance criteria:
     - If Google performance data is unavailable, Aura shows "not connected" or "waiting for permission," not fake values.

4. **Market energy summary**
   - Aura must summarize whether customer energy is rising, falling, or flat.
   - Acceptance criteria:
     - Given rising calls/directions and stable ratings, Aura reports rising intent.
     - Given falling ratings and falling calls/directions, Aura reports weakening market energy.

### P1 - Pilot Mode

1. **Partial bucket activation**
   - Allow a restaurant to mark buckets as virtual, manual-approval, or automated.
   - Initial bucket candidates:
     - Tax Reserve
     - Profit
     - Owner Pay
     - Investor Return
     - Labor
     - COGS
     - OpEx

2. **Transfer approval workflow**
   - Before real movement, present a transfer preview and require approval.

3. **Minimum balance guardrail**
   - Recommend or enforce a minimum operating cash balance before transfers occur.

4. **Pilot report**
   - Show how partial activation performed over 30 days.

### P2 - Enforce Mode

1. **Second onboarding flow**
   - Verify business identity, bank account ownership, target buckets, transfer timing, and guardrails.

2. **Real account setup**
   - Create or link real bucket accounts.

3. **Automated movement**
   - Move funds according to approved rules and timing.

4. **Investor Return lane**
   - Support fixed payment, revenue percentage, profit percentage, or waterfall rules once legally defined.

## Proposed Readiness Signals

### Data readiness

- Bank connected and syncing.
- POS connected and syncing.
- Categorization coverage above threshold.
- Sales history available for at least 14 to 30 days.
- Bucket target settings exist.

### Cash readiness

- Tax Reserve can be funded without driving OpEx below minimum.
- Labor spending is within a tolerable range of target.
- COGS spending is within a tolerable range of target.
- Profit skim can be protected at 1% to 5% without repeated shortfalls.
- Owner Pay is either funded or explicitly marked as not yet supportable.

### Behavior readiness

- Operator has reviewed shortfalls.
- Operator has accepted or adjusted target percentages.
- Operator has chosen pilot buckets.
- Operator has acknowledged transfer timing and guardrails.

## First Implementation Slice

Build **Go-Live Coach v1** as a virtual-only module.

### Inputs

- Current `TapSettings`
- Recent `DailySales`
- Recent categorized `Transaction` rows
- Existing virtual account balances
- Bucket allocations and sweeps

### Outputs

- Current readiness stage
- Bucket-by-bucket readiness
- Simulated allocation for the period
- Shortfall list
- Recommended pilot plan
- Plain-language coaching summary

### Suggested module name

Use one of:

- **Go-Live Coach**
- **Cash Control Plan**
- **Allocation Readiness**

Recommendation: **Go-Live Coach** for product clarity.

## Aura Enrichment Data Plan

### Current

- Google rating and review count
- Yelp rating and review count
- Weekly snapshots
- Overall weighted reputation trend

### Next

- Google Business Profile performance metrics, if API access permits:
  - Calls
  - Direction requests
  - Website clicks
  - Profile views / search views
- Weekly snapshots for those metrics.
- Intent trend over 4 to 8 weeks.

### Later

- Review theme extraction:
  - Service
  - Food quality
  - Wait time
  - Price/value
  - Cleanliness
  - Atmosphere
- Correlate Aura changes with covers, sales, and revenue trend.

## Success Metrics

### Leading indicators

- 80% of connected restaurants receive a readiness stage within 24 hours of data connection.
- 70% of operators view the Go-Live Coach module within the first week after setup.
- 50% of eligible operators accept or adjust recommended Profit First targets.
- Aura displays at least one trend signal for every connected reputation source.

### Lagging indicators

- More restaurants reach Pilot Ready within 60 days of onboarding.
- Operators reduce dollars spent outside intended buckets.
- Tax Reserve shortfalls decrease over time.
- Investor/advisor accounts retain better because they have real-time visibility.
- Restaurants that use Go-Live Coach show higher protected profit and owner-pay consistency.

## Open Questions

### Stakeholder

- What is the first real-money pilot bucket: Tax Reserve only, Profit only, or Tax Reserve + Profit?
- Should investor return be fixed payment, revenue percentage, profit percentage, or waterfall?
- Should owner pay be protected before investor return, or should investor return have a contractual priority?

### Engineering

- Which existing allocation functions can be reused for virtual replay without duplicating logic?
- Do virtual buckets need a new `activationMode` field: `virtual`, `manual`, `automated`?
- Should readiness be computed on demand, snapshotted daily, or both?

### Legal / Compliance

- What licenses, banking partners, or money-movement providers are required before automated transfers?
- What consent language is required for Go-Live activation?
- What disclosures are required for investor-monitoring access?

### Data

- Can Google Business Profile performance metrics be accessed for the target restaurant?
- What historical window is available for calls, directions, and website clicks?
- How should missing or partial Aura intent data affect the market energy score?

## Timeline / Phasing

### Phase 1 - Productize the model

- Add this spec to the roadmap.
- Define Go-Live Coach v1 UI and data contract.
- Add readiness terminology to product copy: Observe, Simulate, Coach, Pilot, Enforce.

### Phase 2 - Build Go-Live Coach v1

- Virtual-only.
- No real money movement.
- Uses existing Profit First settings and live business data.
- Produces readiness, shortfalls, and pilot recommendation.

### Phase 3 - Expand Aura into Market Energy

- Add Google Business Profile performance integration if API access is available.
- Snapshot customer-intent metrics weekly.
- Display rating trend, review velocity, and intent trend together.

### Phase 4 - Pilot Mode

- Add partial activation state by bucket.
- Add manual approval flow for recommended transfers.
- Add guardrails and pilot report.

### Phase 5 - Enforce Mode

- Add second onboarding.
- Link/create real bucket accounts.
- Automate approved transfer rules.
- Add investor return lane after legal and financial rules are resolved.

## Implementation Notes

- Keep v1 virtual. The product should earn trust before it moves money.
- Keep the language operator-friendly. The app should say what to do, not just expose ratios.
- Treat Aura as the outside-world signal and Profit First as the cash-control signal.
- Design the data model so restaurants can later move one bucket at a time from virtual to manual approval to automated.
- Every recommendation should be explainable from visible inputs.
