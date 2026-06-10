# Labor Hours module — spec (queued for the Toast wave)

Status: **not built**. Blocked on the Sling/Toast labor integration. Operator
requested this scope on 2026-06-10; capturing it here so the Toast wave builds
exactly this and the requirement isn't lost.

## What the operator asked for
- **Scheduled hours vs. actual (real) worked hours.**
- **Change in hours over the last 4 weeks** (week-over-week trend).
- **Year-over-year (YoY)** comparison **if available** — show only when prior-year
  data exists; otherwise hide the YoY column rather than invent it.

## Data sources
The operator uses **Sling for scheduling, through Toast.**
- **Scheduled hours** → Sling published schedule / shifts.
- **Actual hours** → Sling/Toast time-clock punches (clock-in/out).
- Toast's Labor API also exposes time entries; either Sling's API or Toast's
  Labor API can feed this. Decide at integration time which is authoritative.

Bank data alone is **not** sufficient — it only carries payroll *dollars*
(e.g. "Toast Payroll" debits), not hours, and never scheduled-vs-actual.

## Metrics to compute (per period, default = week)
- Scheduled hours, actual hours, variance (actual − scheduled) and variance %.
- 4-week series of the above (for a trend chart + WoW deltas).
- YoY: same week last year (scheduled, actual, variance) when present.
- Optional, once sales data is connected: labor % of sales (actual labor $ / net
  sales). Out of scope until Toast sales are in.

## Edge cases / decisions
- **YoY availability:** gate the YoY column on having ≥1 matching prior-year week.
- **Partial weeks / open current week:** mark in-progress weeks so a half-logged
  current week doesn't read as a labor drop.
- **By role/department vs. total:** start with house-total; add per-role split if
  Sling exposes it cleanly.
- Consistency: mirror the existing module pattern — loader in
  `src/lib/modules/labor-hours.ts`, server page at `/modules/labor`, client
  component with the chart, and flip the `labor` tile in `src/lib/modules.ts`
  to `status: "live"`.

## Sourcing options discussed (operator chose to wait for the Toast wave)
1. Export/file import (Sling schedule export + Toast time-clock export) — fastest,
   no API creds. Not chosen.
2. Live Sling/Toast API integration — automatic, bigger build. **Chosen path,
   bundled into the broader Toast integration wave.**
3. Wait for the Toast wave — selected.
