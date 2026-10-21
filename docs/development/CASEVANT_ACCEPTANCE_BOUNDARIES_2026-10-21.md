# CaseVant acceptance and refinement instructions — 21 October 2026

## Purpose and verified baseline

Improve reliable first-action behavior, native editor restart acceptance and evidence editing without risking saved work. This stage follows the canonical [product instructions](CASEVANT_PRODUCT_DEVELOPMENT_INSTRUCTIONS.md), [compatibility stage](CASEVANT_COMPATIBILITY_STAGE_2026-10-20.md) and [workflow refinement stage](CASEVANT_WORKFLOW_REFINEMENT_STAGE_2026-10-20.md). Its dated [audit](../testing/acceptance-boundaries-review-2026-10-21.md) and [machine-readable receipt](../testing/receipts/acceptance-boundaries-2026-10-21.json) distinguish production, archived application, component fixture and native simulator evidence.

Opening canonical main was clean at `7b57cd94e3f37a6245fd3b8e16408ee57914777b`. Public Sites v158 runs source `361b501ebc12416873db25864732c95af5d0345e`. Sites ownership/publication and the source checkout were reverified before edits. Application-input and hosting digests match the [existing native Sites receipt](../testing/receipts/materials-toolbar-v158-2026-10-20.json). The current amendment changes QA and CI only; it does not change the application, saved format, authority rules, source content or report renderer.

Preserve every real and synthetic saved case, all historical factories and immutable original bytes. Keep the rejected stale writer open for recovery. Do not dispose of test cases, overwrite an original case, substitute current source for an unknown version, weaken seals/copy policy, or introduce user-edit merging outside its governed conflict flow.

## 1. First-click pagination and input delivery

Owner: application/QA. Outcome: one received activation loads the next page reliably while preserving the user's query and authority context.

The fresh production trial reaches Loading and then 48 rows from 25. The original unrebuilt v158 Worker/client also reaches 48 through one observed trusted activation, both unfiltered and with filtered search/session/cursor delays. A source-component fixture passes during authority-refresh overlap. These are separate observations; they do not reproduce or universally resolve the historical missed activation.

The isolated runner now provides opt-in `qa_observe=1` on normal Account and catalogue paths. Default archived HTML, client and Worker remain unmodified. The local observer records trusted pointer/submit/focus events, hit tag, viewport, scroll and wall time. It must never read input values, credentials, cookies or storage, issue requests, change handlers, force clicks or replay intent. Production instrumentation is not authorized by this QA amendment.

Next investigation:

1. Establish whether the miss occurs with normal manual input, audit automation, or both. Preserve the unanswered clarification as a limit.
2. Record the actual measured viewport and scale. A requested 390×480 override measured 585×720 in the authorized browser; a calibrated override measured 390×480. Do not equate an automation command with a received click.
3. Pair a trusted pointer or keyboard activation with its hit target, focus, loading transition and cursor request/response. Distinguish offscreen automatic scrolling from an already-visible control.
4. Retain normalized API query and displayed query separately. Account for normal requested-depth restoration when returning to the catalogue; do not mislabel a restored 48-row view as a fresh 25-row baseline.
5. If a received activation actually fails, identify the first divergent boundary and write a regression that fails on the old behavior. Preserve cursor, query, depth and stale-authority fences. Make a product patch only when that evidence supports it.
6. If no failing received-input trace exists, report the exact limit and continue independent work. Do not invent a state-machine fix or claim universal closure from passing retries.

The original runner stopped gracefully: all 581 archive files and the case-table snapshot are unchanged, with no outbound requests. Keep fixture-preparation commit, executed application source, application version, archive hash and fixture hash distinct. Never execute code supplied by a downloaded diagnostic artifact.

## 2. Native editor-restart reliability

Owner: native application/QA. Outcome: the actual editor survives verified process termination and reopening, with native tax behavior and historical values preserved.

Retain the historical preparation and VM-discovery failures. The fresh unchanged-main baseline completed preparation and five phases, then failed `legacy-read` discovery. A matching process/listener is not an authenticated VM URI. An intentional negative control's cleanup message is not the final application's failure.

The reviewed amendments in PR170 are bounded:

- Build this isolated simulator with `--simulator --no-codesign`. The pinned [Flutter 3.44.8 implementation](https://github.com/flutter/flutter/blob/3.44.8/packages/flutter_tools/lib/src/ios/mac.dart#L357) adds provisioning-update/device-registration flags when codesign is enabled. Removing that unnecessary dependency is not proof provisioning caused the earlier timeout. Physical-device/release signing is unchanged.
- Replace one immediate history query with at most three exact-PID/full-executable-path queries, spaced 20 seconds inside the existing 60-second discovery deadline. Each command is limited by the remaining deadline. Retain a raw file and terminal status for every attempt.
- Keep unchanged OS sender/image/event, timestamp freshness, PID/path, authenticated URI, nonce and complete application-bundle checks. Foreign, malformed, expired or permanently absent announcements must still fail. Do not guess a token or use another unauthenticated discovery channel.
- Independently verify every declared raw/status attempt. Preserve legacy one-query receipts. Refuse missing/tampered records, changed status, foreign identity and excess attempts. Do not execute a verifier from downloaded artifacts.

Preparation remains 900 seconds; each of the six runtime phases remains 300 seconds. Do not increase deadlines, suppress assertions, force integration or waive native acceptance.

Portable acceptance: 55 native controls pass; deadline checks have nine passes and two POSIX-only Windows skips; six packaged-client diagnostic tests pass. A failing retained-verifier regression caught its original single-file assumption and was corrected before integration.

Actual Mac push run `39555389139` passes on candidate `51e895da5969e9d82d8bd5695704567af352aef2`: six distinct process IDs and the exact same complete input/installed/final bundle, complete write/read pairs, fresh native reopening, incomplete-input refusal and preserved legacy record. The committed verifier independently reproduces its retained receipt under explicit UTF-8. All six announcements arrived through the stream and used one history query; delayed-history recovery remains fixture evidence rather than an observed Mac recovery. The companion PR run `39555394703` also passes, and its retained proof independently verifies. All candidate gates passed before PR170 merged normally at `d1d56b6671d56803d6179a64afc4e3dbad942a65`. Merge-triggered exact-main checks remain separate observations. One success does not eliminate every intermittent historical failure.

For the next failure, retain the exact source/run/phase, preparation and installation receipts, PID/path, every history attempt, stream arrivals and raw logs. Identify the failed boundary before another amendment. Stop on unexpected loss.

## 3. Production bulk-edit acceptance

Owner: application/content/QA. Outcome: users can reorganize evidence, recover from destructive choices and save independent work without losing provenance or concurrent edits.

The authorized Chrome owner account completed the following on a new, clearly labelled independent Canopy Base copy, saved identity **49**. Retain it and all 48 earlier cases. Its exact category and source reference remain unchanged.

- Two working evidence records selected in the full library and compact inspector.
- Bulk attachment, Move, real application Undo, and duplicate-destination refusal without merging/removing link details.
- Delete-key dialog; Cancel retains graph/history presentation. A confirmed deletion bulk-reattaches both records to another node; Undo restores the original node and links.
- Save, independent reopen, title amendment and save; an older writer is refused with visible conflict while the newer saved title remains current.
- Actual before/after JSON exports preserve every present graph, source, category, premise, core, protection-policy and history-prefix carrier. There is no tax attachment in this case, so this does not establish a tax-case round trip. Local inspection does not cryptographically reverify the server seal.
- Actual three-page Base PDF, materials ZIP and individual evidence file are inspected. All archive text hashes, retained versions and attachments match the saved export. URL-only material has no invented document body.
- Measured 390×480 EN/RU keyboard/DOM checks pass, with a static compact batch toolbar and node destinations sorted by prefix. Authored case text is not automatically translated. Production screenshot capture timed out; DOM observations are not raster acceptance. English and the normal viewport were restored.
- All 48 earlier catalogue metadata tuples match the baseline exactly. Their complete stored bytes were not exported/compared. Cancel has graph/history evidence, not an independently captured production database write trace.

Do not repeat these scoped rows as undelivered. Broaden the matrix with independent labelled copies only when needed:

1. Choose the next retained variant/historical package or full tax case through normal application controls. Record actor, category, exact source/version/fingerprint and new saved identity.
2. Verify two-record attach/move, Delete Cancel/bulk reattach and real Undo. Await actual completion before navigating away; immediate navigation followed by no mutation is an unconfirmed input-versus-cancellation boundary.
3. Save two independent identities, reopen and amend separately. Exercise stale CAS refusal and duplicate destinations without overwriting either copy. Capture actual HTTP status only when available; a UI conflict alone is not proof of HTTP409.
4. Download actual JSON, Base PDF, archive and per-file material; compare exact hashes, text, attachments and every present carrier. Preserve the deliberately complete 254-page ERP Full export and existing PDF locks.
5. Extend owner/role, source/variant, narrow EN/RU and cancellation rows separately. Stop on unexpected loss. Do not generalize owner/Base acceptance to all permissions, variants or account boundaries.

The rejected stale draft remains open in the owned Chrome tab identified by the audit. Workspace-case shared-device caching is refused by existing policy; no device recovery copy is claimed. Do not bypass that guard.

## 4. Recovery, identity and historical execution

Keep unverified local-file recovery separate from owner-verified stored-document recovery. Use local synthetic real-handler/Worker fixtures for owner raw export, foreign refusal, stale source/account cancellation and zero writes. For production owner raw download, first identify an existing legitimately authorized unsupported synthetic saved row through normal application/operator controls. Do not inject unsupported payloads, invent tokens or bypass APIs to manufacture that row. Otherwise retain this precise acceptance limit.

For same-tab account A-to-B, use the authorized identities through normal controls in a demonstrably isolated test session. User controls credential entry. Preserve unsaved tabs, never transfer cookies/tokens between profiles, and distinguish separate-profile observations from same-tab switching. If timing/isolation is unavailable, record the limit before changing authority code. Continue exact handler-fence tests independently.

Execute historical application artifacts only in isolation, with verified original archive bytes and native saved-version/source/archive receipts. Keep application/source/template/envelope versions distinct. A rebuild or pinned module test is not execution of an original published application. Never redeploy v148/v149 or expose live credentials to an old binary. Retain original files on any loss. Verify EN/RU import, manual placement, all tax/evidence/protection/history carriers, unknown fields/versions and explicit refusal of unsafe replacement. Continue the 18 public packages and retained ERP/GreenFire 2.2/2.3/2.4/2.5 and Canopy variants without current-template substitution.

## 5. Source content, retrieval and readiness

Keep the 43 missing-original disclosures until original document bodies are available. Newly authored synthetic passages require stable document/version/section IDs, exact text hashes, explicit synthetic labels and unaccepted decision premises. Additions are not professional approval or accepted evidence. Source acquisition is separate from application compatibility.

Measure finding an authorization, evidence gap, owner and action before broad renderer changes. The 30-second / 80% retrieval targets are hypotheses pending at least five evaluators. Preserve conditional findings, hypotheses, missing sources, full records, bilingual behavior, printing and visual locks. Keep Base and complete Full output clearly distinct.

Service readiness requires qualified operator review of permitted data, access, retention, AI processing and incidents. Commercial pilots require consent and explicit recruitment authorization. Do not send outreach, add analytics, change pricing or claim ROI from this work.

## 6. Review, integration and publication

For every independent slice:

1. Reverify canonical main and deployed inputs; identify the intended user outcome and acceptance criteria before editing.
2. Preserve existing work, implement the bounded amendment and review behavior, wording, navigation, accessibility and data retention.
3. Run proportionate checks and record actual results, failures and unavailable acceptance separately. Keep production, real-handler, component and native evidence distinct.
4. Commit explicit reviewed files, push promptly and integrate through normal PR controls. Reconcile canonical main before starting another implementation slice. No force push, bypass or blanket staging.
5. A changed runtime requires exact-main web/PDF checks, a native Sites receipt and both-origin verification. QA/CI/documentation-only changes with identical application/hosting inputs reference the current v158 receipt without publishing a duplicate version.
6. At handoff, record actual remote/main SHA, remaining dirty-file ownership, pending gates, retained working drafts and precise remaining acceptance limits. Do not claim a deployment merely because a PR merged.
