# SPEC-C2 — Connector Security & Zero-Key Connect Flows

**Status:** Ready for Claude Code
**Branch:** `claude/spec-c2-connector-security` (or fold into `claude/spec-c-onboarding-ladder` if C is not yet merged — C2 depends on C's `ConnectionRequest` model and `sourceLadder.ts` registry)
**Relationship to other specs:** Companion to SPEC-C (extends, does not contradict). Pre-builds the per-tenant credential schema that SPEC-B swaps its OAuth handler into. Does not touch Spec A spines.
**Non-negotiables:** Additive migrations only. Keep 196 Vitest green; add coverage listed in §7. No secret ever reaches a client component, log line, or URL param.

---

## 1. Universal crypto module — `src/lib/crypto.ts`

Single module through which **every** stored secret passes: Plaid access tokens, PosConnection credentials, OAuth refresh tokens.

- AES-256-GCM envelope encryption.
- Key: `ENCRYPTION_KEY` env (Vercel), 32 bytes base64. Fail loudly at boot if missing/malformed.
- Every credential-bearing row carries `keyVersion Int @default(1)` — rotation without migration.
- API surface: `encryptSecret(plaintext): { ciphertext, iv, authTag, keyVersion }` / `decryptSecret(row): string`.
- Decryption happens per-request, in memory only. Never logged, never serialized into responses.

## 2. Schema (additive)

```prisma
model PlaidItem {
  id              String   @id @default(cuid())
  restaurantId    String
  itemId          String   @unique
  institutionName String
  accessTokenEnc  String   // ciphertext
  iv              String
  authTag         String
  keyVersion      Int      @default(1)
  status          String   @default("LIVE")
  createdAt       DateTime @default(now())
  restaurant      Restaurant @relation(fields: [restaurantId], references: [id])
  @@index([restaurantId])
}

model PosConnection {
  id             String   @id @default(cuid())
  restaurantId   String   @unique
  provider       String   // "toast"
  credentialsEnc String   // JSON blob of provider creds, encrypted
  iv             String
  authTag        String
  keyVersion     Int      @default(1)
  mode           String   // "WHITE_GLOVE" | "OAUTH"
  scopes         String[] // read-only, asserted in tests
  createdAt      DateTime @default(now())
  restaurant     Restaurant @relation(fields: [restaurantId], references: [id])
}

model OAuthConnection {
  id              String   @id @default(cuid())
  restaurantId    String
  provider        String   // "gbp" now; "qbo" later reuses this
  refreshTokenEnc String
  iv              String
  authTag         String
  keyVersion      Int      @default(1)
  scopes          String[]
  createdAt       DateTime @default(now())
  restaurant      Restaurant @relation(fields: [restaurantId], references: [id])
  @@unique([restaurantId, provider])
}
```

Note: Toast may already have a credential row from the single-tenant global-env era. Migration path: keep global env creds working for Stone; new tenants only ever get `PosConnection` rows. Do **not** migrate Stone in this spec (that's Spec B's cutover).

## 3. Server-side exchange rules

- All token exchanges in route handlers / server actions behind Clerk middleware.
- Tenant scoping before any decrypt: Clerk userId → `UserRestaurantRole` → restaurantId match, else 403.
- Client components receive **status enums only** (`REQUESTED | AUTHORIZED | PROVISIONING | LIVE | BLOCKED`) — never credential material, never even institution-level metadata beyond display name/logo.
- `sourceLadder.ts` registry gains `scopes: string[]` per entry. Vitest asserts no entry contains a write scope.

## 4. Per-source flows

### 4.1 Plaid — Plaid Link
1. `POST /api/plaid/link-token` — server creates `link_token` (`client_user_id` = Clerk userId, restaurantId in metadata, `products: ['transactions']`, webhook → Inngest ingest route).
2. `react-plaid-link` hosted modal — bank credentials never touch our servers.
3. `onSuccess(public_token)` → `POST /api/plaid/exchange` → `access_token` + `item_id` → encrypted `PlaidItem`.
4. Fire Inngest `plaid/item.connected` → 90-day backfill immediately; existing 6:00 ET daily fan-out continues; handle `SYNC_UPDATES_AVAILABLE` webhook for intraday.

### 4.2 Toast — one tile, dual handler
- **Now (white-glove):** tile click → `ConnectionRequest(toast, REQUESTED)` → Resend template A to ops → ops provisions creds into encrypted `PosConnection` (`mode: WHITE_GLOVE`) via `/admin/provisioning` → status walks REQUESTED → PROVISIONING → LIVE → client LIVE email.
- **Post-Partner-Connect (Spec B):** same tile → redirect to Toast partner auth → callback exchanges → same `PosConnection` row (`mode: OAUTH`) → straight to LIVE. UI, model, status machine unchanged; only the handler swaps.

### 4.3 PDF statement — hosted upload
1. Drag onto tile → server issues signed upload URL, private Supabase bucket, path `statements/{restaurantId}/{uuid}.pdf`, TTL 60s.
2. Upload → Inngest `statement/uploaded` → Anthropic extraction → `RawSourceEvent` → normalized pipeline; ambiguities → `SyncException`.
3. Bucket policy: no public reads, path-scoped per tenant, originals purged after 90 days.

### 4.4 Brokerage / rental CSV — same upload pattern
- Template CSV download link on tile.
- Client-side header validation **before** upload (fail fast, re-offer template).
- Signed 60s URL → private bucket `csv/{restaurantId}/` → Inngest parse.

### 4.5 Cash anchor — plain form
Amount + as-of date, server action. No secrets. Wizard Step 1.

### 4.6 Google Business Profile — authorization-code OAuth
Redirect → Google consent (read-only scopes) → callback exchanges code server-side → refresh token → encrypted `OAuthConnection`. This handler is written generically (`provider` param) so QBO reuses it at Rung 3.

## 5. Wizard (per SPEC-C, restated as acceptance surface)

Header every step: **"About 5 minutes. No API keys — ever."**
- Step 0 businessType (skip if set at signup)
- Step 1 cash anchor — only hard gate; dashboard renders immediately after
- Step 2 Plaid Link + inline PDF-statement skip path (either satisfies gate)
- Step 3 vertical spine (restaurant: Toast concierge tile, REQUESTED does not block; brokerage/rental: CSV drag + template)
- Step 4 sharpen (GBP, invite manager, vendor mapping) + "Skip all"
- Progressive unlock via registry `unlocks[]`; anchor-only Cash Oxygen mode with "first 90 days landing" banner; LIVE flip → Resend + in-app toast.

## 6. Fallback map (no self-serve path)

| Source | Fallback | Template |
|---|---|---|
| Toast pre-Partner-Connect | White-glove, 1-business-day SLA | A |
| MarginEdge | Client auth one-liner + support key request, Rung 3 | B + C |
| Payroll | Cleared-pull inference; CSV payroll-journal bridge; Rung 3 | — |
| Follow Up Boss | Guided key / screen-share — ops handles key, client never pastes into app | D |
| Off-Plaid banks | PDF statement, first-class in Step 2 | E |
| QBO/Xero | Deliberately Rung 3; reuses GBP OAuth handler | — |

## 7. Acceptance criteria + Vitest

**Acceptance:**
- [ ] No plaintext secret in any DB column, log statement, or client bundle (grep CI check for `access_token`/`api_key` in client dirs).
- [ ] All three credential models encrypt via `crypto.ts` only — no inline crypto anywhere else.
- [ ] Plaid Link flow works in sandbox end-to-end: link → exchange → backfill event fired.
- [ ] Toast tile creates ConnectionRequest + fires Resend A; admin provisioning walks status machine; illegal transitions rejected.
- [ ] Signed upload URLs expire; bucket rejects unauthenticated reads; cross-tenant path access rejected.
- [ ] Wizard completion gate: anchor + (Plaid item LIVE **or** ≥1 parsed statement) + vertical spine present-or-skipped; Toast REQUESTED does not block.
- [ ] 196 existing tests green.

**New Vitest cases:**
1. `crypto.ts`: round-trip encrypt/decrypt; tamper (flip authTag byte) throws; missing env throws at import.
2. Registry: every sourceLadder entry has read-only `scopes[]`; write-scope entry fails.
3. Tenant guard: decrypt path with mismatched restaurantId → 403, no decrypt call executed (spy).
4. Status machine: table-driven — all legal transitions pass, all others throw.
5. Wizard gate: table-driven cases per SPEC-C, plus PDF-satisfies-bank-gate case.
6. Upload URL: TTL respected (mock clock), path always prefixed with caller's restaurantId.

## 8. Out of scope
Spec A spines/convergence, Spec B OAuth handler itself, Rung-3 connector implementations, Stone cutover from global env creds, key rotation tooling (keyVersion column only).
