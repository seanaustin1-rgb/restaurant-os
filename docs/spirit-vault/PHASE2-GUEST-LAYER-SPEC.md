# Spirit Vault — Phase 2 Guest Layer Spec (v2, Codex-reviewed)

Status: DRAFT for Sean sign-off · Author: Claude · Codex design review folded in 2026-08-18
Supersedes the deferred "P4" bullet. Phase 1 (daily-code gate + placemat QR) shipped
in PR #150 and is LIVE.

**Lane:** Claude proposes; the tables + auth are the **data spine = Codex's lane**.
Codex has reviewed this design (verdict: sound, with the tightening folded in below).
Nothing is built until Sean signs off.

---

## 1. Positioning (why the model is shaped this way)

The Spirit Vault is **not Untappd**. Untappd is a global, crowd-rated, platform-owned
social network you check into from anywhere — a discovery app that builds loyalty to
*Untappd*, not the bar. The Vault inverts every axis:

| Axis | Untappd | Spirit Vault |
|---|---|---|
| Owns the data | The platform | **The venue** |
| Source of truth | Crowd ratings | **House curation** (Sean's voice) |
| Where it works | Anywhere | **On-premise by design** (daily code); off-prem = paid |
| Who benefits from the data | Untappd | **The operator** (stock/86/hospitality signal) |

Everything below follows: a **house-scoped membership + tasting journal that only
works because you're here**, whose data feeds operator intelligence.

## 2. North stars (all four confirmed by Sean)

1. **Passport / Cellar** — a personal collection scoped to *this house's shelf*:
   tried / untried, progress ("12 of 47 in the bourbon vault"), favorites.
2. **Curator-vs-you** — the guest's 1–5 stars + note beside Sean's curator note for
   the same spirit.
3. **What-to-try-next** — recommendations from **in-stock, priced** pours (Toast)
   using the guest's ratings + the structured flavor axes.
4. **Membership tiers** — free on-premise; **paid off-premise** access + perks,
   plugged into the gate seam already built.

## 3. Identity — Clerk, email magic-link (Codex-confirmed)

- Clerk bills on **MRU (Monthly Retained Users)** — returning users only; one-time
  guests don't count. **50,000 MRUs free/app**, then $0.02/MRU. Codex verified these
  numbers against Clerk's pricing + the Feb 2026 changelog. Effectively $0 for a
  single venue; pennies per regular at multi-venue scale.
- **Email magic-link/OTP** is on the free tier and is the right v1 (lower friction
  than passwords, less sensitive than SMS, recoverable across devices).
- **Clerk Billing** powers the paid membership tier into the gate seam.
- **Guest = Clerk user with no `UserRestaurantRole`** → no admin access, automatically.

> **Codex caveat (action item):** this separation is only safe if every staff surface
> uses a POSITIVE `UserRestaurantRole` check where *absence = deny* (never "authenticated
> ⇒ staff", never auto-onboard/promote by email). A **staff-route audit** is part of the
> 2a-foundation slice below, and staff-invite flows must not grant roles to a guest
> account by email without explicit operator action.

## 4. Data model (Codex-reviewed)

Global `GuestProfile`; all activity tenant-scoped via the composite-FK convention
(matches `SpiritPour`/`SpiritPriceObservation`/`SpiritFlightItem` in the schema).

```prisma
enum GuestMembershipScope { VENUE ACCOUNT }
enum GuestMembershipStatus { ACTIVE PAST_DUE CANCELED }

// Global guest identity — a Clerk user with no UserRestaurantRole.
model GuestProfile {
  id           String   @id @default(cuid())
  clerkUserId  String   @unique
  displayName  String?
  createdAt    DateTime @default(now())
  // relations: visits, tastings, favorites, memberships
}

// On-premise session provenance (Codex: add this — a check-in record).
model GuestVisit {
  id            String   @id @default(cuid())
  guestId       String
  restaurantId  String
  unlockedVia   String   // "day-code" | "member-offpremise"
  createdAt     DateTime @default(now())
  @@index([restaurantId, createdAt])
  @@index([guestId, restaurantId])
}

// One guest's current take on one venue's spirit. Latest-wins for 2a.
model GuestTasting {
  id             String        @id @default(cuid())
  guestId        String
  restaurantId   String        // required
  venueSpiritId  String
  flightId       String?       // tenant-safe FK below
  rating         Int?          // CHECK: rating IS NULL OR 1..5
  note           String?
  // consent for operator/bartender visibility — modeled now, not deferred
  shareWithStaff Boolean       @default(false)
  firstTastedAt  DateTime      @default(now())
  lastTastedAt   DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  venueSpirit    VenueSpirit   @relation(fields: [venueSpiritId, restaurantId], references: [id, restaurantId], onDelete: Restrict)
  flight         SpiritFlight? @relation(fields: [flightId, restaurantId], references: [id, restaurantId], onDelete: SetNull)
  @@unique([guestId, restaurantId, venueSpiritId])
  @@index([guestId, restaurantId])
  @@index([restaurantId, venueSpiritId])
  @@index([restaurantId, lastTastedAt])
}

model GuestFavorite {
  id             String      @id @default(cuid())
  guestId        String
  restaurantId   String
  venueSpiritId  String
  createdAt      DateTime    @default(now())
  venueSpirit    VenueSpirit @relation(fields: [venueSpiritId, restaurantId], references: [id, restaurantId], onDelete: Cascade)
  @@unique([guestId, restaurantId, venueSpiritId])
}

// Read-cache of Clerk Billing state — NOT the payment source of truth.
model GuestMembership {
  id                  String                @id @default(cuid())
  guestId             String
  restaurantId        String                // required in v1 (per-venue)
  scope               GuestMembershipScope  @default(VENUE)
  tier                String                // e.g. "off_premise"
  status              GuestMembershipStatus
  clerkSubscriptionId String?
  currentPeriodEnd    DateTime?
  lastSyncedAt        DateTime?
  @@index([guestId, restaurantId, status])
}
```

Codex-driven changes from v1:
- **Composite FK on `GuestFavorite`** (was missing) and on **`GuestTasting.flightId`**
  (`[flightId, restaurantId] → SpiritFlight`, `onDelete: SetNull`).
- **Unique keys include `restaurantId`** explicitly (`[guestId, restaurantId, venueSpiritId]`).
- **Timestamps** `firstTastedAt`/`lastTastedAt`/`updatedAt`; keep latest-only for 2a,
  add append-only `GuestTastingEvent` **only** if rating/note history is a near-term need.
- **New `GuestVisit`** for on-prem session provenance; **consent flag** (`shareWithStaff`)
  modeled now, since bartender-in-the-loop is part of the value prop.
- **Membership `restaurantId` required + `scope` enum** (VENUE default) instead of a
  nullable restaurantId — account-wide access is explicit, never accidental cross-venue.
- **CHECK** `rating IS NULL OR rating BETWEEN 1 AND 5`; **enums** for membership
  status/tier; **onDelete**: `VenueSpirit` deletion Restricts tastings (preserve
  history), Cascades favorites; `GuestProfile`/`Restaurant` deletes cascade their rows.
- Passport coverage stays **derived** (no stored counter).

## 5. Gate integration (contract change flagged by Codex)

`vault-access.ts` seam is `validDayCode OR member-offpremise`. Filling the member
branch (2c) requires the resolver to become **async and tenant-aware** — today
`resolveVaultAccess(providedCode?)` is sync and carries no `clerkUserId`/`restaurantId`.
That's a planned 2c refactor, isolated to the resolver + its call sites. Membership
checks must be **fail-closed** and tenant-scoped (a VENUE membership unlocks only its
own venue).

## 6. Phasing (Codex: split 2a)

- **2a-foundation** — Clerk guest sign-in; `GuestProfile` + `GuestVisit` +
  `GuestTasting` + `GuestFavorite` + consent field; **staff-route audit** (absence of
  role = deny). No visible feature yet.
- **2a-experience** — the guest UI to **log a rating/note**, the **Passport**, and
  **Curator-vs-you** (clean reads over `GuestTasting` + existing curator fields).
- **2b — What-to-try-next** — recommendation read over 2a data + Toast availability.
- **2c — Membership / off-premise (paid)** — `GuestMembership` + Clerk Billing sync +
  async/tenant-aware `resolveVaultAccess` member branch.

## 7. Operator intelligence (the payoff, on-brand for OutFront)

`GuestTasting` rollups become operator signal: top-rated pours, flights that convert,
"loved but low-stock," 86 candidates — and, **with consent** (`shareWithStaff`),
bartender-in-the-loop hospitality. The thread back to OutFront's core thesis: guest
behavior → operator decisions.

## 8. Decisions

- **Identity:** Clerk email magic-link. ✅ (Sean to confirm.)
- **Membership scope:** **per-venue in v1** (`scope = VENUE`, `restaurantId` required);
  account-wide only later via explicit `scope = ACCOUNT`. (Codex recommendation; was the
  open scope question.)
- **Consent:** modeled now (`shareWithStaff`, default false / private). Sean to set the
  product rule for when/how a guest opts in.
- **Community:** none for v1 (just you + the house). Optional later: a *this-venue*
  regulars' view, never a global feed.
- **Rating history:** latest-only for 2a; add `GuestTastingEvent` only if history
  becomes a near-term product need.
- **Privacy:** guest data retention + export/delete policy to settle before launch
  (esp. any EU guests).
