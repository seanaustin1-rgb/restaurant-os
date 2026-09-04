# Spirit Vault — research brief for Gemini

**Prepared by Claude, 2026-09-04, for Sean Austin (operator).**

## How to use this document

You do **not** have access to the codebase, the GitHub repo, the database, or the
live site. Everything in §2–§6 below was verified against the actual repository on
2026-09-04 — treat it as **given fact you cannot check**, and do not hedge every
sentence with "assuming this is accurate." If something here is load-bearing for
your answer and you think it might be wrong, say so specifically and ask.

Your job is **not** to audit the build, review code, or propose architecture.
Claude and Codex are doing the build with repo access. Your job is the thing they
are worst positioned to do: **look at this from outside and tell Sean what he
should be considering, and what he should cut.** He is deliberately running you in
parallel as an outside perspective.

§7 is where the actual questions are. §8 tells you what would waste his time.

---

## 1. The business

- **Makers' House** in York, Pennsylvania. Within it, **Echo's Reserve** — a
  high-end tasting room and curated spirits program.
- Curated library of **200 spirit records** (bourbon, rye, agave, rum, vodka,
  amari), of which **109 are currently guest-visible** and 91 are unpublished
  drafts.
- Physical product already exists: curated **flights** (max 4 pours), printed
  **placemats**, whiskey dinners, and **physical challenge coins** for milestones.
- Sean is an experienced restaurant operator, not a full-time software engineer.
  He directs the build; AI agents implement it.
- Hard constraint: **near-zero recurring software cost.** No SevenRooms, no
  Punchh, no per-seat loyalty SaaS. Free tiers only (Vercel, Supabase, Clerk).

There is also a broader product, **OutFront Data** (`www.outfrontdata.com`) — a
multi-industry operator dashboard (Profit First cash management, bank/POS
integration). Spirit Vault lives inside that same codebase and shares its
infrastructure. **Spirit Vault is not the main business** — it is a venue-facing
product built on the operator platform. Keep that proportion in mind.

---

## 2. What Spirit Vault is

A **digital bottle dossier + guest passport**, accessed on a phone, in the room.

The guest scans a code, browses the curated library, and logs what they tasted
with a rating and notes. Over time that becomes a passport, and passport
milestones map to the physical challenge coins Echo's Reserve already gives out.

Positioning Sean has already settled on, versus Untappd/Distiller:
- **Venue-owned**, not a platform. The data is Echo's, not a third party's.
- **Curated**, not crowdsourced. Every dossier is written and source-reviewed.
- **Present-by-design.** You have to be in the room. That is the point.
- It feeds **operator intelligence** back to Sean (what's being tasted and rated).

---

## 3. What is actually built and working today

This is further along than most "we're planning an app" conversations. Verified:

**Catalog and content**
- Canonical multi-tenant spirit schema in PostgreSQL. 200 records live in a demo
  database, with publication lifecycle (draft → reviewed → published), price
  history, and per-venue listings.
- An admin console for editing dossiers, a publish-time validator that blocks
  incomplete records, and an importer that is idempotent.
- 26 of the 91 draft records were just given source-reviewed factual content
  (producer, origin, proof, aging, cited sources). Still hidden pending approval.

**Guest access — this is the clever part and it already ships**
- A **daily rotating access code**, derived as an HMAC of (venue secret, venue
  local date). Deterministic, so any day's card can be reprinted identically, but
  nobody can compute tomorrow's code. No database, no cron job, no per-guest
  tokens.
- The code is printed on a **staff table tent** that is reprinted daily. It is
  **not** on the flight placemat — because not every guest orders a flight, and
  every guest needs a way in.
- Scanning sets a cookie that expires at venue midnight.

**Membership (live in production)**
- Guest accounts via Clerk email magic-link.
- Admin-issued membership codes, **hashed at rest** (HMAC-SHA256 + pepper),
  plaintext shown exactly once, revocable, with an append-only redemption log.
- A one-year membership entitlement. The full loop has been verified end-to-end
  in production.

**Flights**
- Flight builder with templates, a 4-pour cap, printable placemats and prep sheets.

---

## 4. Decisions already locked — do not re-open these

Re-litigating settled decisions is the main way an outside advisor wastes time.
These are closed:

| Decision | Rationale |
|---|---|
| **Next.js + Postgres + Clerk, deployed on Vercel** | Already built and in production. Not switching stacks. |
| **Clerk for auth, not Supabase Auth** | Clerk bills by *monthly active* users, so one-time guests are effectively free. Also see the security note in §6. |
| **PWA, not native apps** | No app-store friction for a guest who is already seated. |
| **One canonical spirit catalog** | A second bottle table would create a permanent sync problem. |
| **Daily rotating code as the presence gate** | Built, shipped, working. |
| **Reading may go off-premise on a paid tier; writing a passport stamp never can** | The stamp *is* the proof of presence. If a subscription could mint stamps from the couch, the coins stop meaning anything. |
| **Venue voice is Sean's** | Curator notes and "why we carry it" copy are written by him, never generated. Factual bottle data is sourced and cited; tasting judgments are his. |

---

## 5. Where this is going next

**Immediate (next build increment):**
- A guest tasting/check-in record, written only when the guest presents a valid
  day code, stamped with the venue-local date.
- A "My Passport" view: what you've tasted, your rating beside the curator's note,
  coverage of the library.
- Badges computed from check-ins rather than stored as rules. A record is written
  only when a physical coin is actually handed over.

**Deliberately postponed:**
- Apple/Google Wallet passes.
- Toast POS integration for automatic check-ins.
- In-app payment for membership (currently: coupon-code redemption).
- Multi-venue white-label (guest vault on a venue-branded domain rather than
  `outfrontdata.com` — Sean's view is that "outfrontdata" in a guest-facing URL
  reads as data-mining and creates hesitancy).

---

## 6. Constraints, risks and honest limits

Things a good outside advisor should know before proposing anything:

1. **The presence gate is a shared daily secret.** It proves "someone in the room
   had today's card," not "this specific person was at the bar." A guest can text
   the code to a friend. This is an accepted trade for a cheap, offline,
   no-hardware mechanic — but it is a real limit, and any anti-fraud proposal
   should be weighed against how much it actually matters for a loyalty passport.
2. **A prior security incident shapes the architecture.** Row-level security was
   off across all public database tables while the public API was enabled — real
   data exposure. It was fixed by disabling that database API entirely; access now
   goes exclusively through the server. **Any proposal that involves the browser
   talking to the database directly re-opens that hole** and is a non-starter
   without a full row-level-security policy pass first.
3. **Two AI agents share one working directory**, which has caused branch churn and
   duplicated work. Coordination overhead is real and is currently the main drag on
   delivery — not technical difficulty.
4. **The main branch has not moved in over two weeks**; roughly 17 pull requests are
   stacked behind it, including two competing implementations of the same feature.
   Throughput, not capability, is the bottleneck right now.
5. **Guest scale is unknown to me.** So are membership price, current member count,
   and coin economics. See §9 — do not model economics without asking.

---

## 7. What Sean actually wants from you

**Consider, and cut.** Be opinionated. "It depends" is not useful here.

1. **Regulatory — this is the highest-value thing you can research.**
   Pennsylvania is a liquor-control state. Many US jurisdictions restrict
   promotions that **reward volume of alcohol consumption** — inducements to
   drink, free drinks as loyalty rewards, and similar. A passport that gives you a
   physical coin for tasting more spirits could plausibly touch PLCB rules.
   **Neither Sean nor I know the answer, and I am not qualified to give it.**
   Research what Pennsylvania actually permits for on-premise licensee loyalty and
   rewards programs, flag where this design may need to change (e.g. rewarding
   *breadth of exploration* or *visits* rather than volume, or non-alcohol
   rewards), and be explicit about where he needs a PA liquor attorney rather than
   an AI answer. This could reshape the product; better to know now.

2. **What should be cut?** Look at §3 and §5 and tell him what is scope creep.
   He is one operator with two AI agents and a stale main branch. What would you
   remove to ship something guests actually use?

3. **Will the mechanic drive behavior?** The bet is that a digital passport plus a
   physical coin increases repeat visits and exploration beyond the well-known
   pours. Is there real evidence for that in hospitality loyalty? Where do
   passport/stamp mechanics fail? What makes them feel like a chore?

4. **Competitive reality check.** Untappd, Distiller, Whiskybase, and restaurant
   loyalty platforms. Is "venue-owned and curated" a genuine wedge, or is he
   rebuilding something guests already have and won't switch from? What is the
   honest case *against* building this at all?

5. **The paid off-premise tier.** The plan is that browsing your vault from home
   becomes a paid subscription. Is that something a guest would actually pay for,
   or is it a feature in search of a price? What would you charge, and what else
   should be in the tier to make it worth buying?

6. **Data sensitivity.** This records what individuals drink, by name and email.
   That is more sensitive than typical loyalty data. What should he be thinking
   about on retention, consent, and disclosure — beyond generic privacy-policy
   advice?

---

## 8. How to waste his time

Please do not:
- Recommend a different tech stack, framework, or hosting provider.
- Suggest features already built (see §3) — especially loyalty codes, QR access,
  membership tiers, or an admin console.
- Propose paid SaaS (loyalty platforms, CDPs, analytics suites). Near-zero
  recurring cost is a hard constraint, not a preference.
- Produce a generic startup framework — lean canvas, personas, a 12-month roadmap,
  an MVP checklist. He has a working product and a specific set of open questions.
- Give legal conclusions with false confidence. On §7.1, research and cite what
  you find, then say plainly where a PA attorney is required.
- Pad with caveats. He would rather have a wrong strong opinion he can argue with
  than a hedged summary.

---

## 9. Ask before you model anything

I do not have these numbers and neither will you. If your answer depends on one,
ask rather than assume:

- Covers per night / week; what share are repeat guests.
- Current Echo's Reserve membership price and member count.
- Cost and current issuance rate of the physical challenge coins.
- Average spirit pour price and margin. (Menu pours in the current data run roughly
  $6–$19 for a 1.5 oz pour, but that is the catalog, not the sales mix.)
- What Sean considers success at 6 months — repeat visit rate, membership sales,
  exploration beyond the top sellers, or something else entirely.
