# Business Model & V1 Gate — 2026-10-18

> Strategy decisions from a claude.ai chat session with Sean (2026-10-18), plus an outside
> review from Gemini. **No code changed.** This doc records what was decided and what it
> means for the build, so Claude Code sessions pick it up. Read alongside
> `docs/PRODUCT-MAP.md` and the RESUME block in `docs/SESSION-HANDOFF.md`.

## The one-line version

**OutFront Data is the business. Spirit Vault is a module. Nothing ships to outside
operators until V1 runs clean on Stone Grille.**

## Why this matters

Sean's goal: OutFront becomes the income that makes owning the restaurant optional
(target ≈ $200k/yr owner income ≈ $16.7k MRR). Possible later exits: acquisition by a
platform like Toast or MarginEdge, or a licensing / revenue-share deal. Either way,
acquirers buy traction (paying tenants, low churn, proof beyond one restaurant), so the
path is the same: finish V1, prove it on Stone, then sell.

## Decisions Sean made

1. **V1 is the gate.** The A6 path in SESSION-HANDOFF still applies: clear Stone's sync
   exceptions, verify Tax Vault / Cash Flow / Spending / Forward Cash on real data, pass
   `compare-spines`. Working bar from the chat: Stone's daily reconciliation runs clean
   for 7 consecutive days without manual intervention. *(Exception count was 373 as of
   the July handoff — re-run `scripts/summarize-sync-exceptions.ts stone` for current.)*
2. **Two sales channels for OutFront:** direct to operators, and indirect through
   accountants / bookkeepers / fractional CFOs. Either the operator or the accountant
   can pay.
3. **Operator-paid account ⇒ their accountant gets a free seat.** This is the channel
   recruiting itself.
4. **Accountant master account** covering multiple clients. Pricing NOT set
   ("$150/mo + $50/client" was only an example).
5. **Referral loop is fine both ways:** if an operator's accountant later brings in more
   accounts, the original operator can get a discount. Suggested guardrail (not yet
   decided): tie the discount to clients the accountant actually brings and pays for,
   not to the master-account upgrade alone.
6. **Spirit Vault = direct sale to the operator**, and an add-on **toggle inside
   OutFront** (operators always have a login, even when an accountant brought them in).
   Vault-only plan also possible for bars that come in through Vault first.
7. **Pricing is key** — stack fatigue is real (operators already pay for Toast,
   MarginEdge, a bookkeeper). Position OutFront as finding dollars, not as another
   dashboard; consider integrating with MarginEdge rather than competing.
8. **Toast partner route is wanted** (marketplace listing + write access). Ideal flow:
   photo of a wine bottle / liquor bottle / beer can → populates both the Toast item and
   the Vault card.
9. **Workaround until write access exists:** Vault generates data formatted for Toast's
   **bulk upload**, so a batch of new bottles goes in with one upload.

## Build implications (for Claude Code)

### Billing / entitlements (Spec E)
- **Payer is per product, not per tenant.** One restaurant can have OutFront paid by its
  accountant and Vault paid by the operator. Confirm Clerk Billing supports two
  subscriptions with different payers on one tenant before locking the design; the
  `TenantPlan` Postgres mirror stays the single entitlement source of truth.
- Vault is another entitlement flag on the plan. **Only the operator can toggle it on**
  — an accountant must not be able to turn on a paid add-on for a client.
- Accountant roles needed: free seat (operator-paid) vs master account (multi-client,
  portfolio view including clients who pay directly). Partner/channel pricing should sit
  below direct pricing from day one.
- Open policy: what happens when a direct-paying operator's accountant later upgrades to
  a master account. Leaning: client stays operator-paid unless the accountant brings and
  pays for them.
- Know per-tenant cost (Plaid, Toast, Anthropic usage) before setting channel prices.

### Spirit Vault
- **Guest side walled off:** the public QR menu must be served from a separate,
  read-only endpoint that cannot reach anything else in the tenant (Vault puts a public
  page on a platform holding financial data).
- The Toast-button → canonical-bottle matching (one-tap confirm, e.g. "ER 10YR" →
  Eagle Rare 10 Year) doubles as **beverage cost data cleanup for OutFront**. One build
  serves both products.
- **Bulk-upload export:** match Toast's actual bulk upload template — pull the current
  template from Toast Web and build to its columns, don't guess. If the template has a
  SKU/PLU field, write a Vault ID into it so the sync matches on ID and skips the
  one-tap confirm for anything that originated in Vault. One-tap matching stays for
  items staff add directly in Toast.
- Photo → card: AI identifies the bottle and drafts the card (Age | Proof | Attribute |
  Price + description) and a matching Toast bulk-upload row. Existing audit gate in
  `docs/spirit-vault/HANDOFF.md` (real sources, no fabricated awards, hold ambiguous
  identities as draft) still applies to anything AI drafts.

### Product direction from outside review (Gemini)
- Lead with **alerts, not a dashboard** — operators don't log in; the product tells them
  when something's wrong. (Daily Digest, A9, is already this pattern.)
- Add **investors / multi-concept owners** as a buyer alongside accountants.
- **Alerts in dollars, not percentages** (Profit First edge; "you're $1,840 short of your
  tax allocation this month"). Gemini proposed percentage benchmarks — rejected as
  off-philosophy.
- **Year-over-year comparisons** so seasonality doesn't trigger false alarms (Gemini's
  90-day lookback would make every January look like a crisis).
- Threshold-based "flag, don't advise" framing helps limit liability (not a legal shield).
  Consistent with the existing rule that signals stay deterministic.

## Toast partner program — what research found (2026-10-18)

- Application is slow and competitive: Toast reports high application volume and
  prioritizes partly on **customer demand** — name mutual customers asking for the
  integration. Then compliance / privacy / security / legal approval, a signed partner
  agreement, and an assigned integration rep before development.
  Source: https://pos.toasttab.com/partners/integration-partner-application ·
  https://doc.toasttab.com/doc/devguide/integrationDevProcess.html
- Approved partners get **scoped read and write** access on shared customers; Toast
  grants only what the integration needs. OutFront is analytics → request read; don't ask
  for write it can't justify. Source:
  https://doc.toasttab.com/doc/devguide/apiPartnerIntegrationOverview.html
- Self-service standard API access (what a restaurant buys directly) is reported to be
  **read-only**. Source (third party): https://www.usecarly.com/blog/toast-pos-ai/
- **Menu-item creation via API is not publicly documented**, even for partners. A Toast
  community thread requesting AI/agent menu creation got "not currently available."
  That's both demand evidence and a warning Toast may build it. Ask the integration rep
  directly. Source:
  https://community.toasttab.com/t5/restaurant-operations/feature-request-ai-agent-mcp-connector-for-toast-menu-and/m-p/18916
- Customer-side friction: the Toast Integration Marketplace comes with Restaurant
  Management suites, so smaller restaurants may need to upgrade to add a partner app.
  Source: https://support.toasttab.com/en/article/Set-Up-Toast-Partner-Integrations

## Market notes (unverified, mostly vendor blogs)

- Beer menus (Untappd for Business ≈ $899–1,199/yr), wine lists, and bar inventory
  (WISK, Backbar) are crowded. Uncorkd covers spirits and is the closest Vault competitor.
  No clear spirits-specific guest-experience leader found.
- Standalone Vault pricing likely $39–49/mo, not $99–149 (Untappd anchors expectations).
- Owners want: no double entry, minutes-to-setup, works on a Saturday night. Flab:
  public ratings, enterprise multi-location extras, scale-weighing for small bars.
- **Brand/distributor-paid placement in Vault likely conflicts with federal and PA
  tied-house law. Do not build a revenue model on it** without a liquor-law attorney.

## Rough math (illustrative, prices not set)

- ≈84 tenants at $199/mo direct ≈ $16.7k MRR.
- Example channel structure floated: master account $150/mo, accountant-paid clients
  $99, volume break $79 past 25 clients → 10 partners × 15 clients ≈ $16.4k MRR.

## Order of work

1. V1 gate on Stone (above).
2. Bottle matching — serves both OutFront (bev COGS) and Vault.
3. Vault entitlement toggle + walled-off guest endpoint.
4. Bulk-upload export; photo → card.
5. Toast partner application strengthened by named Toast customers asking for it.
