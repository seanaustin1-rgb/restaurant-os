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
