# Heartbeat Visual Implementation Plan

## Product intent
The heartbeat is the first read of business condition. It should help an operator,
consultant, accountant, or investor understand whether the business is steady,
tightening, slipping, or missing critical data before they dig into modules.

## V1: Single-business heartbeat summary
Ship a top dashboard band that turns existing module data into five lenses:

1. Cash Oxygen
   - Can the business breathe after a virtual pilot set-aside?
   - Source: Go-Live Coach cash safety.

2. Profit Discipline
   - Are dollars being named and protected?
   - Source: Go-Live Coach stage, categorization coverage, readiness summary.

3. Operating Pressure
   - Which operating lane is closest to breaking?
   - Source: Profit First TAP gauges and prime cost.

4. Sales Momentum
   - Is demand moving or softening?
   - Source: revenue, real revenue, covers flow.

5. Aura / Market Energy
   - Are outside-world signals wired?
   - Source in V1: Aura module connection prompt; future: reviews and Google Business Profile intent.

Success criteria:
- The dashboard can answer "what needs attention first?" in under 10 seconds.
- The summary links into the deeper module that explains the signal.
- V1 uses existing data only; no new integrations are required.

## V2: Role-specific emphasis
Use the same heartbeat data but change emphasis by selected role.

Operator Mode:
- "What do I need to do this week?"
- Prioritize action language, setup gaps, and operating pressure.

Advisor Mode:
- "What should I talk to this client about?"
- Prioritize watchouts, wins, changes since last check-in, and coaching prompts.
- V1 shipped as an advisor brief for Consultant and Manager roles:
  - top watchout
  - top win
  - missing data
  - Go-Live status
  - suggested conversation prompt

Investor Mode:
- "Is the business getting safer or riskier?"
- Prioritize cash oxygen, discipline, runway, investor return readiness, and trend risk.

## V3: Industry templates
During onboarding, choose a heartbeat template based on business type.

Restaurant template:
- Prime cost, labor, COGS, sales mix, covers, menu engineering, Aura, tax reserve, Profit First.

Service business template:
- Cash runway, AR aging, payroll load, job profitability, recurring costs, lead flow, satisfaction.

Retail template:
- Gross margin, inventory turn, sell-through, cash runway, returns, web/foot traffic, reviews.

V3 should hide irrelevant modules by default and surface industry-specific setup tasks.

## V4: Advisor / portfolio console
Add a paid add-on for accountants, consultants, investors, and groups managing many businesses.

Core jobs:
- Rank clients by heartbeat risk.
- Show who needs a call this week.
- Show who improved since last check-in.
- Show missing data and stale integrations.
- Show Go-Live readiness across the portfolio.

This is likely the strongest expansion product because it turns one-dashboard value
into many-client workflow value.

## Open questions
- What roles should be first-class: operator, advisor, investor, accountant, franchisor?
- Should industry template be chosen once during onboarding or editable later?
- What threshold makes Aura move from setup gap to true health signal?
- What is the first external system needed for portfolio value: accounting, bank, POS, or CRM?
