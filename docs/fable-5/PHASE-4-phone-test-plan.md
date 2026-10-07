# Team Hub Phase 4 phone test plan

Scope: Spec F build-order Phase 4. Branch: `team-hub-4-feed`. Base: `79b6c1b` (merged PR #171).
No schema changes, migrations, database setup, merge, or deployment performed by this PR.

## Automated coverage

- Tenant rejection before Team reads/writes: feed, summary, lesson page, progress, visit beacon, lesson creation/publication, draft list/status.
- Published visibility through `visibleLessonFilter`: departments, managersOnly, MEMBER/CONTRIBUTOR in MGMT, MANAGER/Owner.
- Newest-first feed, keyset pagination with equal timestamps; 14-day shift brief expiry at the boundary, still searchable and available by stable link.
- Search titles/takeaways/normalized tags and category/tag chips; visible facets and unseen counts.
- Two-session last-visit counts, viewed-progress exclusion, monotonic visit timestamps, and publications arriving during a visit.
- Union of actual played ranges, ≥90% watched threshold, skipped/replayed time, cumulative visits, malformed input, stale versions and progress privacy.
- Manager-approved publication, READY gate, audit log, current manager authority, duplicate ready events, delivery failure recovery, and no implicit import/submission publication.
- Signed-out Team return-path preservation and external redirect rejection; stable lesson page 404s and safe DTOs.
- TUS resume from server offset, ambiguous PATCH retry, pause, and bytes sent only to Stream.
- Existing Team DB grep gate and Phase 1–3 access/removal/token tests remain in the full suite.

Draft-management reads are explicitly author/role guarded and limited to UPLOAD/DRAFT/REVIEW; published reads always use `visibleLessonFilter`.
Publish-when-ready uses existing REVIEW status plus a transactional PUBLISH_WHEN_READY action-log intent.
The media-ready Inngest worker, the new publication worker, and upload-status polling honor the intent only if its manager still has access.
Played ranges are persisted in existing action-log JSON; serializable transaction retries merge coverage across visits/tabs without a migration.
Owners/business managers need a verified primary Clerk phone to create their first author membership. It is a MEMBER record: business-role authority remains the source of manager privileges. Existing phone rows must be claimed through the invite flow.

## UNVERIFIED before pilot launch

- Real iPhone/Android completion within five minutes, backgrounding/network changes, touch scroll-snap, autoplay restrictions and caption readability.
- Sling in-app browser → Clerk SMS OTP → exact lesson return, including the selected tenant.
- Live Stream direct-upload CORS, signing configuration, webhook delivery, generated English captions, and Inngest event/retry registration.
- Live Team tables/composite foreign keys/RLS, tenant enablement, roster data, and Clerk phone/claim configuration.
- Browser beacons are best effort on hard termination. Progress is client-reported playback coverage, not tamper-proof proof of viewing.
- Owners without an active Team membership can view lessons, but do not have persisted personal visit/progress records until that membership exists.
- Publication intent and playback-range audit queries use existing indexes. Pilot-volume latency and retention/storage growth need live measurement.
- If Inngest event delivery and the media-ready job both fail after intent persistence, upload-status polling recovers it when the author returns.
- R2 assignments/required strip, check questions, demonstrated marks, published-content editing/version resets, Moments and imports stay in their later phases.

## Phone acceptance run

Use a preview/pilot tenant with Team Hub enabled, real Stream/Inngest credentials, and test accounts: FOH MEMBER, BOH MEMBER, CONTRIBUTOR in FOH+MGMT, Team MANAGER, Owner, and a removed member. Also have tenant B for isolation. Repeat steps 1–5 on iPhone Safari and Android Chrome.

1. Start a timer. Record a 2–3 minute vertical shift brief. Open Team → New lesson, pick it, and fill type/title/takeaway/category/tags/audience while it uploads. Toggle managers-only for a separate test lesson. Confirm video bytes go directly to Stream, no public provider ID/media URL is exposed.
2. Interrupt Wi-Fi briefly; use Resume upload. Confirm progress resumes rather than creating a new upload. Pause/resume explicitly. Test a processing failure and starting a new lesson.
3. Tap Publish when ready while processing. Close the page. Confirm one publication/audit log after READY, with expiry exactly publication + 14 days. Reopen the draft list. Retry the webhook/job and confirm no duplicate publication. Record upload→publish→copy-link time; target ≤5 minutes.
4. Save a contributor draft; verify it stays unpublished. A manager opens Team drafts and publishes when READY. Confirm a contributor cannot publish, cannot list another contributor's drafts, and a member cannot open the authoring screen.
5. Copy the published link into Sling. Open it signed out in Sling's mobile browser, complete phone OTP, and confirm the exact lesson and tenant load. Repeat with a bare /team/learn/<id> link. Confirm written takeaway, English captions when available, sound toggle and accessible player controls.
6. Publish all-staff, FOH, BOH and managers-only lessons. Confirm chronology and department filtering. MEMBER and CONTRIBUTOR in MGMT must see no managers-only lesson/category/tag in feed/search/counts, and receive the same 404 as a missing lesson on direct link and token. MANAGER and Owner can see it.
7. Swipe several lessons and background the phone. Only the visible lesson should play; sound begins muted. Verify readable takeaway/captions, no horizontal overflow at 320px, and usable controls in portrait/landscape. Load a second cursor page and confirm no repeated/gapped lessons.
8. Watch 89%: not watched. Watch ≥90%: watched. Seek straight to the end: not watched. Replay the same segment: no inflated coverage. Watch complementary sections over two visits: cumulative coverage completes. Remove the member: next token/progress/feed request fails.
9. Note Since your last visit count/minutes. Leave and return: old items no longer count. Publish a lesson during the visit: it must count on the next visit. Watch an item without finishing it: it is in progress and no longer part of the unseen count. Repeat in two tabs.
10. With a test shift brief whose expiry is in the past, confirm it is absent from Newest, present in matching search/category/tag results and available at its stable link. Drafts/archived status must not appear to staff.
11. Attempt every Phase 4 page/API/action with tenant B as a tenant-A-only user. Expect 404 for pages or 403 for operations, no tenant-B payload or media token.
12. Remove/demote the approving manager or disable Team Hub before queued media becomes READY. Confirm the job does not publish. Recheck token expiry/revocation and production page source/network responses for unsigned media URLs.

Capture phone model/OS/browser, preview commit, timings and failures. The live R1 boxes remain unchecked until these results are recorded.
