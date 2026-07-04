# Investor Demo Script — Brokerage / Vacation-Rental View
**Audience:** First investor — real-estate broker + vacation-property manager. He IS the customer for two of six verticals. Run it as a customer demo that happens to end in an ask.
**Length:** 20 min demo + 10 min ask/discussion. Phone first, laptop second.

---

## T-minus checklist (all must be green before the meeting)

| # | Item | Status source |
|---|------|--------------|
| 1 | Merge `claude/rule-guardrails-and-triage` | Open action since Chunk 1 |
| 2 | Run triage script on Stone, batch-clear the 373 exceptions | Confidence badge must read 90%+ on the toggle beat |
| 3 | Fix or hide Sandbox Diner (48 exceptions / 0 ledger entries) | Never demo a broken tenant |
| 4 | Digest live and landing on YOUR phone daily | Beat 1 depends on a real received email, not a mock |
| 5 | Forward-cash module live w/ low point + date | Beat 2 — backlog #2, scoped as assembly |
| 6 | Brokerage demo tenant seeded: CSV pipeline loaded w/ pending closings, recurring bills confirmed, Owner Payouts bucket earmarked | Beats 2–4 |
| 7 | Restaurant modules / Aura / GBP / benchmarks / soon-tiles hidden on brokerage tenant | Nothing that says "restaurant SaaS in a costume" |
| 8 | Rehearse the toggle (Stone → brokerage) — must be < 5 seconds | Beat 5 |

If #5 slips: fallback is Commission Pipeline + Recurring shown side by side with you narrating the merge — weaker, survivable. If #2 slips, the confidence badge becomes the honest-machine beat instead (see Beat 6) — do not fake the number.

---

## Beat 1 — The 6am email (0:00–2:00, phone in hand, laptop closed)

Hand him your phone showing this morning's actual digest.

> "Before we open a laptop — this is what my restaurant sent me at 6am. Cash position, what hit the account yesterday, the one thing that needs my attention. I didn't log into anything. I read it with coffee."

Then the thesis, one sentence:

> "OutFront is a daily retrospective with a forward edge — every morning you know where the business is and where the next 30 days pinch, without hunting reports or waiting on your bookkeeper."

Do not explain Profit First yet. Let the email do the talking.

## Beat 2 — Forward cash, the low point (2:00–7:00, laptop, brokerage tenant)

Open the brokerage tenant directly — he sees HIS vocabulary first, not a restaurant.

Walk the 30-day forward cash chart. Deliver the sentence the whole meeting is built around:

> "Your low point is [date] at $[X] — three days before the [name] closing funds on the [date]."

Then the structural insight, spoken to him as a broker:

> "Your business is a calendar of money that isn't yours yet. Pending commissions have dates — that's a receivables calendar my restaurants would kill for. The engine already treats your pipeline as scheduled inflows."

Click into Commission Pipeline to show closings feeding the forecast. Every number click-throughs to its math — say that out loud once: "nothing on this screen is a black box."

## Beat 3 — Owner Payout Vault (7:00–10:00, rental side)

Switch to (or scroll to) the rental view. Point at the earmarked Owner Payouts bucket.

> "And this is money that isn't yours at all. Owner payouts accrue here the day the booking revenue lands — visually walled off from operating cash before any sweep. You can't accidentally spend an owner's money, and you can show any owner the wall."

This is the property manager's existential fear handled structurally. Pause here. Let him react — this beat generates the most questions, and his questions ARE the vertical's product spec. Take notes visibly.

## Beat 4 — Every dollar named / the residual (10:00–13:00)

Allocation view: GCI → agent splits → company dollar → buckets → residual line.

> "Named $148K of $152K. $4K unnamed — click it."

Click through to exception review, name one transaction live, watch the residual shrink.

> "The unnamed number is the leak detector. Most dashboards hide what they don't know. This one leads with it."

## Beat 5 — The toggle (13:00–16:00)

The TAM slide, performed live:

> "Watch this."

Flip to Stone Grille. Same layout, every label changes — GCI becomes Sales, Agent Splits becomes COGS, closings become covers. Flip back.

> "Same engine, zero forked code. An industry is a config file: vocabulary, defaults, vendor rules. Restaurants, brokerages, vacation rentals live today — wineries and contractors are a file each. That's the business you're investing in: one engine, N industries, near-zero marginal cost per vertical."

## Beat 6 — The honest machine (16:00–18:00)

Point at the confidence badge.

> "One more thing, because you'll ask eventually: what happens when the data's messy? The dashboard tells you. 'Confidence 94% — 12 transactions unnamed, $3,100.' It never claims certainty it doesn't have. When confidence drops, the language softens automatically. Financial tools lose trust the first time they're confidently wrong — this one is built to never be."

(If T-minus #2 slipped and Stone still shows the 373: lean IN. "Here's Stone mid-cleanup at 71% — watch the language change." Weakness converted to feature.)

## Beat 7 — Onboarding, preempted (18:00–20:00)

He will worry about setup friction because YOU worry about it. Say it before he does:

> "Setup is one bank link — Plaid, same thing your bank app uses — plus a CSV of your pipeline. No API keys, no IT project. First insight inside 24 hours; the first week names your local vendors, then it goes quiet. Everything else is optional depth."

## The Ask (20:00–30:00)

Two-part ask — capital plus design partnership, because the second makes the first smarter:

> "I'm raising $[X] to get from launch to [N] paying operators across three verticals. But you specifically I want as more than a check — you're the design partner for brokerage and rental. Your books seed those verticals' vendor intelligence, your questions from the last twenty minutes become the roadmap, and you get the product shaped around your operation before anyone else in your market sees it."

Structure/terms per your existing plan — the promissory-note format you've run before works; adjust to what this raise actually needs. Close with a date:

> "Launch is [date]. I'd like you on your own data before then — can we get your Plaid link done this week?"

**The real close is the Plaid link, not the check.** If he connects his accounts, he's invested before he's invested.

---

## Objection handling

**"QuickBooks / my bookkeeper already does this."**
"QuickBooks tells you what happened last month, after your bookkeeper closes it. This tells you where you stand this morning and where you pinch in three weeks. Different job. It sits beside QBO, not instead of it."

**"My PMS shows me revenue already."**
"Your PMS knows bookings. It doesn't know your bank, your obligations, or the wall between owner money and yours. This is the layer that knows all three."

**"What happens when it's wrong?"**
Point back at Beat 6. "It tells you it's unsure before it's wrong. That's the design."

**"Why isn't this just for restaurants?"**
Beat 5 already answered it; if it recurs: "The math of an operating business — money in, money named, money protected — doesn't care about the industry. Only the vocabulary does, and vocabulary is a config file."

**"What's the moat?"**
"Vendor intelligence compounds per vertical — every named transaction makes the next tenant's first week quieter. Plus the digest habit: a tool you read every morning at 6am is a tool you don't churn from."

## Failure contingencies

- **Live demo dies:** screen-record the full flow the night before, phone-quality is fine. Narrate over the recording without apologizing.
- **He goes deep on a module that's thin:** "That's exactly the kind of thing the design partnership decides — tell me how you'd want it to work." Every gap becomes his roadmap input.
- **He asks for MLS/PMS integration on the spot:** "Roadmap, gated behind proving the CSV flow first — deliberate. Zero API keys before first insight is a core principle. You'd be the pilot when we wire it."
