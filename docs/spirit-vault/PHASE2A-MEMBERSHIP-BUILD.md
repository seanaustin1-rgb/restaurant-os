# Spirit Vault — Membership Access Build Spec (Phase 2a, for Codex)

Status: BUILD SPEC · Author: Claude · 2026-08-18
Companion to `PHASE2-GUEST-LAYER-SPEC.md` (v2, Codex-reviewed). This is the concrete,
actionable build order for the **membership access** slice — the first thing to build.

**Lane split (firm):**
- **Codex (data spine):** Prisma tables + migration, redemption server actions, the
  `resolveVaultAccess` change, admin code-generation actions, the staff-route audit.
- **Claude (guest UI):** Clerk sign-in surface, the "redeem code" screen, membership
  status UI, and the vault gate's "enter membership code" affordance.

---

## 1. Goal & guardrails

Sell an **Echo's Reserve membership** that includes **full vault use for one year**
(on *and* off premise, no daily code needed), redeemed by a **code**. No in-app
payment yet — Sean sells the membership his way and the code grants access.

Confirmed decisions (Sean, 2026-08-18):
- **Account-based** (not a shareable cookie pass). A code binds a year of access to a
  verified account.
- **Identity = Clerk email magic-link** (email verification is intrinsic).
- **Codes: one shared reusable code for the test window; per-member single-use codes
  ultimately.** The model must support both from day one.
- **Payment automation deferred** (Clerk Billing later).
- **Interim free access unchanged:** the daily rotating scan code stays for non-members
  (free, on-prem). Members bypass it via their membership.
- **Server-verified, restaurant-scoped, revocable, redemption-tracked. Never put codes
  or member data in static HTML/JSON.** (We're already DB-backed server routes.)

## 2. Scope of THIS slice

IN: guest identity (Clerk email-link) · `GuestProfile` · `MembershipCode` ·
`GuestMembership` · redemption flow · `resolveVaultAccess` member branch · admin
code-gen/revoke/redemptions · guest redeem + status UI · staff-route audit.

OUT (later slices): tasting journal / passport / favorites (needs `GuestTasting`
etc.) · what-to-try-next · Clerk Billing pay-to-join · per-member bulk code generation
(one reusable code is enough now, but the schema supports per-member).

## 3. Data model (additive; extends spec v2)

```prisma
enum MembershipCodeStatus { ACTIVE REVOKED }
enum GuestMembershipStatus { ACTIVE EXPIRED REVOKED }

// Global guest identity — a Clerk user with no UserRestaurantRole.
model GuestProfile {
  id           String            @id @default(cuid())
  clerkUserId  String            @unique
  email        String?
  displayName  String?
  createdAt    DateTime          @default(now())
  memberships  GuestMembership[]
  redemptions  MembershipRedemption[]
}

// An admin-issued, restaurant-scoped code that grants a fixed-length membership when
// redeemed. Supports BOTH a shared reusable code (maxRedemptions null/high) and a
// per-member single-use code (maxRedemptions = 1).
model MembershipCode {
  id              String               @id @default(cuid())
  restaurantId    String
  code            String               // normalized, unambiguous, grouped e.g. RSRV-7K2Q-9M4X
  tier            String               @default("echo_reserve")
  grantDays       Int                  @default(365) // membership length granted on redemption
  maxRedemptions  Int?                 // null = unlimited; 1 = single-use (per-member)
  redemptionCount Int                  @default(0)
  status          MembershipCodeStatus @default(ACTIVE)
  label           String?              // e.g. member name / batch note
  expiresAt       DateTime?            // code's own validity window (distinct from grantDays)
  createdByClerkUserId String
  createdAt       DateTime             @default(now())
  redemptions     MembershipRedemption[]
  @@unique([restaurantId, code])
  @@index([restaurantId, status])
}

// Append-only redemption log (who redeemed what, when). One account can redeem a given
// code at most once (the @@unique), so a shared code can't be stacked by one person.
model MembershipRedemption {
  id               String         @id @default(cuid())
  membershipCodeId String
  guestId          String
  restaurantId     String
  membershipId     String?        // the GuestMembership it created/extended
  redeemedAt       DateTime       @default(now())
  code             MembershipCode @relation(fields: [membershipCodeId], references: [id], onDelete: Cascade)
  guest            GuestProfile   @relation(fields: [guestId], references: [id], onDelete: Cascade)
  @@unique([membershipCodeId, guestId])
  @@index([restaurantId, redeemedAt])
}

// The entitlement the gate checks. Read-cache-compatible with a future Clerk Billing
// sync (clerkSubscriptionId stays null for code-granted memberships).
model GuestMembership {
  id                  String                @id @default(cuid())
  guestId             String
  restaurantId        String                // required (per-venue in v1)
  tier                String                @default("echo_reserve")
  status              GuestMembershipStatus @default(ACTIVE)
  source              String                @default("code") // "code" | "billing"
  clerkSubscriptionId String?
  startedAt           DateTime              @default(now())
  currentPeriodEnd    DateTime              // startedAt + grantDays
  createdAt           DateTime              @default(now())
  guest               GuestProfile          @relation(fields: [guestId], references: [id], onDelete: Cascade)
  @@index([guestId, restaurantId, status])
  @@index([restaurantId, currentPeriodEnd])
}
```

Notes:
- **CHECK / enums:** statuses as enums; `grantDays > 0`; `redemptionCount >= 0`.
- **onDelete:** guest/ code deletes cascade their logs; membership rows cascade with the
  guest. Restaurant delete cascades tenant rows (matches spec v2).
- **No composite FK to VenueSpirit here** — membership is venue-scoped by `restaurantId`
  only; it isn't about a specific spirit.
- A guest's **active membership** = `status = ACTIVE AND currentPeriodEnd > now()` for
  that `restaurantId`. Expiry can be lazily evaluated (compare `currentPeriodEnd`) and/or
  swept by a job later; don't rely on a cron for correctness.

## 4. Redemption flow

1. Guest signs in (Clerk email magic-link) → ensure a `GuestProfile` exists (upsert on
   `clerkUserId`).
2. Guest submits a code. Server normalizes (uppercase, strip separators) and looks up
   `MembershipCode` by `(restaurantId, code)`.
3. **Validate (server, fail-closed):** exists · `status = ACTIVE` · not past `expiresAt`
   · `maxRedemptions` null OR `redemptionCount < maxRedemptions` · this guest hasn't
   already redeemed it (`MembershipRedemption` unique).
4. On success (one transaction): create `GuestMembership` (`currentPeriodEnd =
   now + grantDays`; if the guest already has an ACTIVE membership, **extend** from the
   later of now / existing end rather than duplicate) · insert `MembershipRedemption` ·
   increment `redemptionCount`.
5. Guest now has full vault access for the year.

**Anti-abuse:** rate-limit redemption attempts per account/IP; generic error messages
(don't reveal whether a code exists); codes are high-entropy random (not guessable).

## 5. Gate contract change (Codex)

`resolveVaultAccess` must become **async + tenant-aware** to check membership:

```ts
// was: resolveVaultAccess(providedCode?) : VaultAccess   (sync)
// now: resolveVaultAccess({ providedCode?, clerkUserId?, restaurantId }) : Promise<VaultAccess>
//   1. if !dayGateEnabled -> open
//   2. valid day code (provided or cookie) -> { allowed, via: "day-code" }
//   3. clerkUserId has an ACTIVE, unexpired GuestMembership for restaurantId
//        -> { allowed, via: "member-offpremise" }   // works on- AND off-premise
//   4. else -> denied
```

Update the three call sites (`/vault`, `/vault/flights`, `/vault/flights/[id]`) to pass
`clerkUserId` (from Clerk `auth()`) + the tenant. Members thus reach the vault with **no
day code, anywhere**. Keep it fail-closed: any lookup error → treat as no membership.

## 6. Admin (Codex actions + Claude UI)

- **Generate code:** creates a `MembershipCode` (random grouped code, `grantDays=365`,
  `maxRedemptions` — null for the shared launch code, `1` for per-member later, optional
  `expiresAt`, `label`). Returns the code once for display.
- **List / revoke:** set `status = REVOKED` (existing memberships already granted stay
  valid — revoking a code only stops *new* redemptions; to kill an entitlement, revoke
  the `GuestMembership`).
- **Redemptions view:** who redeemed which code and when (from `MembershipRedemption`).
- OPERATOR/MANAGER gated (reuse `SPIRIT_VAULT_STAFF_ROLES` posture).

## 7. Guest UI (Claude)

- Sign-in surface (Clerk email-link) reachable from the vault gate ("Members / sign in").
- **Redeem screen:** enter code → success shows "Echo's Reserve member — full access
  through <date>."
- **Membership status** somewhere in the vault (a small "Member ✓ through <date>" chip).
- The gate's existing code box should accept a **membership code** too (route it to
  redemption when signed in; prompt sign-in first if not).

## 8. Staff-route audit (Codex, before guests exist — spec v2 caveat)

Confirm every staff/admin surface uses a **positive `UserRestaurantRole` check where
absence = deny**. A guest (Clerk user, no role) must never pass a staff gate, and
staff-invite flows must not auto-grant a role to a guest by email.

## 9. Open items for Sean

1. **Launch code:** one shared `RSRV-…` code, `maxRedemptions = null` (unlimited) or a
   cap? And should the code itself expire (e.g. end of the test window)?
2. **Code format:** confirm grouped `RSRV-XXXX-XXXX` style is fine.
3. **Membership length:** 365 days from redemption (assumed) — confirm.
4. **Re-redeem / renewal:** extend from current end (assumed) vs block until expired.
