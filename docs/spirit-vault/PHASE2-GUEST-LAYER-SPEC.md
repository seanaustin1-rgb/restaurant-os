# Spirit Vault — Phase 2 Guest Layer Spec (DRAFT)

Status: DRAFT for Sean + Codex alignment · Author: Claude · 2026-08-18
Supersedes the deferred "P4" bullet in the Phase-1 plan. Phase 1 (daily-code gate +
placemat QR) shipped in PR #150.

**Lane:** Claude proposes this spec and owns the guest-facing UI. The new tables +
auth are the **data spine = Codex's lane** — nothing here is built until Codex and
Sean sign off on the model. This doc is the alignment surface.

---

## 1. Positioning (why the model is shaped this way)

The Spirit Vault is **not Untappd**. Untappd is a global, crowd-rated, platform-owned
social network you check into from anywhere — a discovery app that builds loyalty to
*Untappd*, not to the bar. The Vault inverts every axis of that:

| Axis | Untappd | Spirit Vault |
|---|---|---|
| Owns the data | The platform | **The venue** |
| Source of truth | Crowd ratings | **House curation** (Sean's voice) |
| Where it works | Anywhere | **On-premise by design** (daily code); off-prem = paid |
| Who benefits from the data | Untappd | **The operator** (stock/86/hospitality signal) |

Everything below follows from that: a **house-scoped membership + tasting journal
that only works because you're here**, whose data feeds operator intelligence.

## 2. North stars (all four confirmed by Sean)

1. **Passport / Cellar** — a personal collection scoped to *this house's shelf*:
   tried / untried, progress ("12 of 47 in the bourbon vault"), favorites. The
   retention hook.
2. **Curator-vs-you** — the guest's 1–5 stars + note stored beside Sean's curator
   note for the same spirit. Palate-building against house expertise.
3. **What-to-try-next** — recommendations drawn from **in-stock, priced** pours
   (Toast) using the guest's ratings + the structured flavor axes. A conversion
   engine, not window-shopping.
4. **Membership tiers** — free on-premise; **paid off-premise** access + perks,
   plugged into the gate seam already built (`resolveVaultAccess` member branch).

## 3. Identity (recommended: Clerk, email magic-link)

**Recommendation: Clerk guest accounts with email magic-link / OTP sign-in.**

- Clerk bills on **MRU (Monthly Retained Users)** — users who return *a day after
  signup*. One-time guests don't count. **Free up to 50,000 MRUs/app**, then
  $0.02/MRU (volume-discounted). A single venue never approaches 50k *returning*
  guests; cost is effectively $0 until multi-venue scale, then pennies per regular.
- **Email magic-link/OTP is on Clerk's free tier** (SMS codes / passkeys are what
  require Pro at $25/mo). Lowest friction that still gives a real, recoverable
  account.
- **Clerk Billing** (PricingTable + `has()` entitlements) can power the paid
  membership tier directly into the gate seam — one system for identity *and*
  membership, vs. bolting Stripe onto a hand-rolled magic-link.
- **Separation from staff is automatic:** a guest is a Clerk user with **no
  `UserRestaurantRole`** → no admin access. Staff (tiny count) and guests share the
  same free tier.

> OPEN (Sean): confirm Clerk-email-link vs. lightweight magic-link. Everything in §4
> except `GuestProfile`/membership is identity-agnostic, so this can be finalized late.

## 4. Data model (proposal — Codex owns final shape)

Follows the canonical split model + composite tenant-FK convention (PR #137).
`GuestProfile` is **global** (a guest can visit multiple OutFront venues); tasting
data is **tenant-scoped**, so a passport is per-venue and can also aggregate.

```prisma
// Global guest identity. clerkUserId is the bridge to Clerk; a guest is simply a
// Clerk user with no UserRestaurantRole.
model GuestProfile {
  id           String          @id @default(cuid())
  clerkUserId  String          @unique
  displayName  String?
  createdAt    DateTime        @default(now())
  tastings     GuestTasting[]
  favorites    GuestFavorite[]
  memberships  GuestMembership[]
}

// One guest's take on one venue's spirit. (guest, venueSpirit) unique — latest
// rating/note wins; history can live in an append-only table later if wanted.
model GuestTasting {
  id             String       @id @default(cuid())
  guestId        String
  restaurantId   String
  venueSpiritId  String
  rating         Int?         // 1..5 (DB CHECK), nullable = tried, not rated
  note           String?
  flightId       String?      // if tasted as part of a flight
  tastedAt       DateTime     @default(now())
  guest          GuestProfile @relation(fields: [guestId], references: [id])
  venueSpirit    VenueSpirit  @relation(fields: [venueSpiritId, restaurantId], references: [id, restaurantId])
  @@unique([guestId, venueSpiritId])
  @@index([restaurantId, venueSpiritId]) // operator rollups
}

model GuestFavorite {
  id             String       @id @default(cuid())
  guestId        String
  restaurantId   String
  venueSpiritId  String
  createdAt      DateTime     @default(now())
  guest          GuestProfile @relation(fields: [guestId], references: [id])
  @@unique([guestId, venueSpiritId])
}

// Drives the paid off-premise tier + the resolveVaultAccess member branch. Mirrors
// Clerk Billing subscription state (source of truth = Clerk; this is the read cache).
model GuestMembership {
  id                String       @id @default(cuid())
  guestId           String
  restaurantId      String?      // null = account-wide; set = per-venue membership
  tier              String       // e.g. "off_premise"
  status            String       // active | past_due | canceled
  currentPeriodEnd  DateTime?
  guest             GuestProfile @relation(fields: [guestId], references: [id])
  @@index([guestId, status])
}
```

- **Passport/coverage** is derived, not stored: `count(distinct GuestTasting.venueSpiritId where restaurantId=X)` over `count(published VenueSpirit for X)`. No denormalized counter to drift.
- **Curator-vs-you** joins `GuestTasting` to the existing `SpiritDefinition.whyShort` / curator fields — no new curator storage.
- **What-to-try-next** = untried published `VenueSpirit` with a priced in-stock `SpiritPour`, ranked by flavor-axis proximity to the guest's highly-rated spirits. Pure read over existing tables + `GuestTasting`.
- **DB CHECK:** `rating BETWEEN 1 AND 5`. All additive tables — zero risk to existing models (same posture as the Phase-1 migration).

## 5. Gate integration (already seamed)

`src/lib/spirit-vault/vault-access.ts` already resolves as
`validDayCode OR (future) member off-premise entitlement`. Phase 2 fills the second
branch:

```ts
// in resolveVaultAccess, after the day-code checks:
if (await memberHasOffPremiseEntitlement(clerkUserId)) return { allowed: true, via: "member-offpremise" };
```

So an off-premise **member** reaches the vault without today's code; everyone else
still needs to be on-site. No gate rework.

---

## 6. AMENDMENT — the stamp rule (Sean, 2026-09-04)

> "The passport is driven by the scan code… the scan code is the **stamp on the
> passport that they were here**."

This splits the gate into **read** and **write**, which §5 did not distinguish:

| Action | On-site (valid day code) | Off-premise member (future paid) |
|---|---|---|
| **Read** the vault / your passport | ✅ | ✅ — that is what the tier buys |
| **Write** a passport entry (stamp) | ✅ | ❌ **never** |

A stamp asserts physical presence. If a subscription could mint stamps from the
couch, the passport stops meaning anything and the challenge coins lose their
basis. So the write path gates on `via === "day-code"` — **not** on `allowed`.

### 6.1 Schema delta to `GuestTasting`

Add one column; everything else in §4 stands.

```prisma
  /// Venue-local day (YYYY-MM-DD) whose code stamped this entry. Non-null by
  /// construction: a row cannot be written without a valid day code. Makes
  /// "you were here on these dates" derivable, and makes the presence claim
  /// auditable rather than implied.
  stampedDayKey  String
  @@index([guestId, stampedDayKey])   // visit history / streak + visit-count badges
```

Distinct `stampedDayKey` per guest = **visit count**, for free, with no visits
table. That is the natural axis for coin milestones alongside bottle coverage.

### 6.2 Two constraints found in the live code (verified 2026-09-04)

**a) Check-ins must be Server Actions under `/vault/*`.** `/v/[code]/route.ts`
sets the `sv_day` cookie with `path: "/vault"` — deliberately, so a same-day
bearer credential is never sent to app/admin/API routes. A Server Action invoked
from a `/vault/**` page posts to that same path and receives the cookie; an
API route at `/api/passport/**` would **not**. Colocate with the existing
[`src/app/vault/actions.ts`](src/app/vault/actions.ts).

**b) No day secret ⇒ no stamps, ever.** `dayGateEnabled()` is false when
`SPIRIT_VAULT_DAY_SECRET` is unset, `isValidDayCode` returns `false`, and
`resolveVaultAccess` yields `via: "open"` — which the write gate must reject.
That is correct (fail-closed on writes while fail-open on reads), but it means
the secret is a hard prerequisite for the passport, and `.env.local` does not
currently set one, so the stamp path cannot be exercised locally without a dev
secret. Prod was configured 2026-08-18 — re-verify before relying on it.

### 6.3 Where the scan code lives (Sean, 2026-09-04)

**The scan code is NOT on the flight placemat.** It is its own printed piece —
the staff-printed table tent at `/admin/spirit-vault/today` — because **not every
guest orders a flight**, and every guest needs a way in. The placemat and the
scan code are deliberately separate artifacts.

Current state, verified 2026-09-04:

| Surface | `main` | branch `codex/flight-builder-availability-hardening` |
|---|---|---|
| Table tent `/admin/spirit-vault/today` | renders QR + code ✅ | unchanged ✅ |
| Flight placemat | **still renders QR + code ❌ (wrong)** | layout no longer renders it ✅, but the route still calls `qrSvg()`/`todayCode()` and passes an unused `qr` param — **dead code to remove** |

So the placemat fix exists only on that branch. Until it lands, `main` still
prints the code on the placemat. Removing it should also drop the now-unused
`qrSvg` / `todayCode` / `dayGateEnabled` imports from the placemat route.

### 6.5 ⚠ SUPERSEDES 6.1 — the passport is ATTENDANCE, not tasting (Sean, 2026-09-04)

> "The passport is only that they attended that day. Perhaps a double check-in on
> a special event."
>
> "For now the milestones can be set to the side. If we get to a point whereby
> people can give their own tasting notes and make suggestions to other tasters,
> then they can elevate to a status similar to the 'local guide'."

This is a **scope cut, and a large one**. The passport is a visit record. It is
not a tasting log, and for v1 it **does not reference `VenueSpirit` at all**.

| | v1 | Later |
|---|---|---|
| Passport entry | attendance for a day | unchanged |
| Tasting notes / ratings | **cut** | returns as the *contribution* layer |
| Milestones / badges | **cut** | revisit after the above |
| Earned status | none | contributor reputation ("local guide" model) |

Consequences:

- **`GuestTasting` is deferred.** v1 needs one table keyed on
  `(guestId, restaurantId, stampedDayKey, kind)` — no `venueSpiritId`.
- **`@@unique` moves to the day axis.** One stamp per guest per day per kind. The
  `@@unique([guestId, venueSpiritId])` rule in §4 belongs to the deferred tasting
  layer, not to the passport.
- **Status is earned by contributing, not consuming.** The future ladder rewards
  writing useful notes and recommending to other guests — not volume. That is a
  materially safer posture than a consumption milestone (see §6.4).

#### Special events — use a second code, not a special case

Sean wants a "double check-in" on event nights (whiskey dinners, release
tastings). Do **not** add a weight/multiplier column. Give the event its own
printed code, derived from the same primitive with a different input:

```
daily  code = HMAC(secret, `${tenant}:${dateKey}`)            // existing table tent
event  code = HMAC(secret, `${tenant}:${dateKey}:${eventId}`) // event card
```

Deterministic, reprintable, no new table, no cron — identical properties to the
day code. A guest at an event scans both and gets two stamps naturally, because
they are different `kind` values on the same day. The rule stays "one stamp per
guest per day per kind," with no exception branch to maintain.

#### Making a pure attendance passport worth opening

Honest risk: "you have been here 12 times" is thinner than "you have tasted 40 of
109 bottles," and the guest supplies nothing. Mitigation that needs **no guest
input and no new data**: render each attended date with what was actually poured
that day, derived from the existing flight records — "Aug 12 · the night we poured
the Sagamore flight." The passport gets substance for free, and it stays a record
of *being there*, which is the whole point.

### 6.7 ⚠ SUPERSEDES 6.6 — the currency is VISITS (Sean, 2026-09-04, final)

> "We will operate by the times they dine and not what or how much they drink. If
> they just have dinner and scan the code each time then it counts."

**This is the operating rule. It replaces the pour-threshold idea in §6.6 outright.**

- The passport ledger is **visits**. Not pours, not bottles, not spend.
- **A guest who never drinks can fully participate.** Dinner + scan = a stamp.
  Nothing in the passport may require a pour to be meaningful.
- The food offer, if any, keys off **visit count**, never off drink count.

**Consequences:**

1. **`GuestPour` is deferred, along with `GuestTasting`.** v1 is **one table** —
   the visit stamp of §6.5. Everything in §6.6 below is retained for reference
   only and is **not** the v1 build.
2. **The regulatory concern in §6.6 and §7.1 of the Gemini brief largely
   dissolves.** Rewarding people for dining is an ordinary restaurant loyalty
   program; rewarding them for drinking is the thing that draws scrutiny in a
   control state. A PA attorney read is still sensible before anything is
   advertised, but this is no longer a design risk that could reshape the product.
3. **The "thin passport" problem stands** and the §6.5 mitigation is now the
   answer, not a nice-to-have: render each attended date with what was poured that
   night, derived from existing flight records. It needs no guest input, and it is
   the only content the passport has.
4. The special-event second code (§6.5) is unaffected and still applies.

Honest limit, unchanged: the stamp records **a scan**, which stands in for a
visit. The day code is shared, so it proves someone in the room had it. That was
already the accepted trade and it does not get worse here.

---

### 6.6 ~~AMENDS 6.5 — record pours as well as attendance~~ (SUPERSEDED by 6.7 — reference only)

> "If it isn't much to do then I would say that we record both. I can offer food
> options if they have had a certain amount of pours."

So v1 records **two things**: the visit stamp (§6.5) *and* which pours were had.
They stay separate tables — the stamp is proof of presence and never depends on
the catalog; the pour log is what was tasted.

#### `GuestPour` — lighter than the deferred `GuestTasting`

```prisma
  guestId        String
  restaurantId   String
  venueSpiritId  String
  stampedDayKey  String    // same venue-local day key as the stamp
  loggedAt       DateTime  @default(now())

  @@unique([guestId, venueSpiritId, stampedDayKey])  // one log per spirit per day
  @@index([guestId, stampedDayKey])                  // "pours today" -> food threshold
  @@index([restaurantId, venueSpiritId])             // operator rollups
```

**No rating and no notes in v1.** Those belong to the contribution layer in §6.5
and return with it. This is only "I had this."

Why unique on `(guest, spirit, day)` rather than the `(guest, spirit)` of §4:

- **`(guest, spirit)`** — one row ever — gives coverage ("40 of 109 tried") but
  cannot count tonight's pours, so it cannot drive a food threshold.
- **No uniqueness** — one row per tap — counts pours but lets a guest tap the same
  spirit ten times to cross a threshold.
- **`(guest, spirit, day)`** gives both: distinct spirits ever tried, pours logged
  today, and a natural ceiling on same-night repetition.

#### ⚠ The food reward changes the threat model — do not auto-comp

Recording pours is cheap. Making a pour count **trustworthy enough to give away
food** is not, and that distinction is the whole cost here.

A guest self-logging their own pours is unverified. Attendance stamps are cheap to
fake but the reward is low-value, so nobody bothers. **The moment the reward has
real food cost, the self-reported count becomes an attack surface** — tap four
bottles you never ordered, claim the plate.

Three ways to make a count trustworthy, in increasing cost:

| | Trust | Cost |
|---|---|---|
| Guest self-logs | none | free — already the plan |
| Staff confirms at the bar | high | a staff-facing screen + staff adoption |
| Toast check data | highest | Phase 3, already deferred |

**v1 recommendation: log pours, but do not automate the comp.** Surface the count
to staff as a *prompt* — "this guest has logged 4 pours tonight" — and let a human
decide. Zero fraud surface, no Toast dependency, and the bartender already makes
this judgment. Automate it later against staff-confirmed or Toast-verified counts.

#### ⚠ Regulatory — this is the case that most needs the PA answer

A food comp keyed to *how many drinks you have had* is the textbook shape of a
consumption inducement, and Pennsylvania is a liquor-control state. Rewarding food
rather than more alcohol is very likely a better posture, and it may even read as
responsible service — food slows absorption, and offering it to a guest several
pours in is good hospitality before it is a promotion. **But that is reasoning, not
a legal finding, and nobody here is qualified to give one.**

Two framings, which may not be treated the same way:

- "Have 5 pours, earn a free appetizer" — a volume-based inducement.
- "We bring something from the kitchen to guests settling in for a tasting" — staff
  hospitality, exercised by judgment, with the pour count as an internal prompt.

The second is what §6.6 recommends building, and it is materially easier to defend.
Get a PA liquor attorney to confirm before any of it is advertised to guests.

### 6.4 Anti-fraud posture (honest limits)

The day code is a *shared* daily secret on a printed table tent, so it proves
"someone in the room had today's card," not "this specific person was at the bar."
That is the right trade for a loyalty passport — cheap, offline, no hardware.
Worth stating plainly rather than overclaiming: a guest could text today's code to
a friend. Mitigations if it ever matters, in increasing cost: rate-limit stamps
per guest per day; cap stamps per day (you cannot taste 40 bottles in a night);
per-table rather than per-venue codes; eventually Toast check-level verification.
`stampedDayKey` is what makes any of those enforceable later.

## 6. Phasing

- **2a — Foundation (biggest value, smallest surface):** Clerk guest sign-in +
  `GuestProfile`/`GuestTasting`/`GuestFavorite` + the guest UI to **log a rating/note**
  and see the **Passport** and **Curator-vs-you**. North stars 1 & 2. No billing.
- **2b — What-to-try-next:** recommendation read over 2a data + Toast availability.
  North star 3.
- **2c — Membership / off-premise (paid):** `GuestMembership` + Clerk Billing +
  fill the `resolveVaultAccess` member branch. North star 4.

## 7. Operator intelligence (the payoff, on-brand for OutFront)

Because the venue owns the data, `GuestTasting` rollups become operator signal:
top-rated pours, flights that convert, "loved but low-stock," "86 candidates" — and,
with consent, **bartender-in-the-loop** hospitality ("regular loves high-proof
wheated, hasn't tried the new Weller"). This is the thread back to OutFront's core
thesis: guest behavior → operator decisions.

## 8. Open questions

1. **Identity:** confirm Clerk-email-link (recommended) vs. lightweight magic-link.
2. **Membership scope:** per-venue or account-wide off-premise access? (`GuestMembership.restaurantId` nullable supports either.)
3. **Bartender-in-the-loop consent:** opt-in per guest before any staff can see a passport. Default = private. Need Sean's rule.
4. **Community:** none by default (just you + the house). Optional later: a *this-venue* regulars' view, never a global feed. Confirm we stay non-social for v1.
5. **Data/privacy:** guest data retention + export/delete policy (esp. if EU guests ever). Additive now, but decide before launch.
