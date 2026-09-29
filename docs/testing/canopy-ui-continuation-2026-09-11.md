# Canopy UI continuation — 11 September 2026

This continues the Prod 75 audit. It does not close the full commercial-readiness, cold-onboarding or real-video acceptance scope. The candidate is recorded in the same commit as this document; the final deployment receipt names the published version and full commit.

## Changes and reproducible defects

The following defects were established by source inspection and automated state tests. Browser reproduction and visual acceptance remain pending because the browser service times out even when listing tabs.

| ID / priority | Reproduction and impact | Fix / acceptance criterion | Evidence |
|---|---|---|---|
| C01 P1 | On Canopy case A, follow an explicit link to case B. The navigation helper overwrote B with A. A run could also be carried into a different case/scenario or organization. | Explicit target selection wins. Preserve language and the selected organization; inherit the current dossier/run only within the same context. A changed organization does not inherit the old return target's case. | `canopy-ui-continuation.test.ts` cross-case, cross-organization, explicit-scenario tests. Browser pending. |
| C02 P1 | Open A, select B, press Back. Previously opening a copy used replaceState and local state initialized once; global navigation also kept the old copy. | A different copy pushes a history entry and dispatches the shared navigation event. Current selection derives from the URL; recording a session replaces only its current entry. | URL round-trip/back-state tests; source review of shared subscription and event dispatch. Actual browser Back/Forward pending. |
| C03 P1 | Cause the saved-copy list to return 401/403/500 or a network error. Previously the failed request appeared as an empty selector. More than 25 unrelated matters also hid older Canopy copies. | Server search filters Canopy before pagination. Separate loading, empty and failed states; provide retry and My cases. State explicitly that at most 25 recent matching copies are shown. | Read-only transport tests for valid, malformed, authorization, server and network responses; server route q/limit contract inspected. |
| C04 P1 | A case loads but the publication-status request fails. Previously the whole case disappeared behind a reopen failure. | Preserve authoritative case/source/proposal/output reads when the catalogue check fails. Show a retry instruction and keep start disabled until publication is verified. Reopen errors offer Retry and the case link. | Source review; existing publication-state tests distinguish missing/mismatch/errors. Live outage interaction pending. |
| C05 P1 | Switch to Russian in shared navigation. Previously Canopy controls, guidance and states stayed English. | Russian/English workflow labels, scenario explanations, roles, errors, next-step guidance and report states. Original immutable English sources and graph statements are explicitly identified and retained. | Language-copy tests preserve all source bytes and both Base fingerprints. Full linguistic/visual acceptance pending. Matters and historical admin copy are still partially untranslated. |
| C06 P1 | A session completes on an unexpected terminal stage, or has a different case/version/fingerprint. Previously a fingerprint match could display the expected recommendation as the actual result. | Render the server's terminal-stage headline. Separate expected comparison cards. Validate case/version/fingerprint, terminal/completion status and timestamp before labeling completion; flag a different terminal outcome and disable linking/sealing in that UI state. | State tests across five fixture declarations, mismatched identifiers, active/nonterminal/invalid completion and unexpected terminal. Backend authorization and evidence checks unchanged. |
| C07 P2 | After completing reviews/runs, the UI still said to review sources. Reviewers/viewers saw preparation actions without explaining their role. | Next action reflects sources, proposals, publication, run, evidence linking and reports. Show authoritative case role and use server-returned permissions for buttons. Independent approval stays in My cases. | Source/server permission-map review; actual owner/reviewer/viewer checks pending. |
| C08 P2 | Green standalone typography, crowded source rows and a wait cursor on permanently disabled controls weakened consistency and keyboard clarity. | Use existing Genesis paper/ink/brass styling, flexible rows, 44px action height, visible focus, narrow-screen layout and not-allowed disabled cursor. Add four in-page section links. | CSS/source review only. Mobile, keyboard and 200% zoom remain Not verified. |

## Validation boundary

Targeted tests cover navigation, error classification, immutable fixture identity and actual-result presentation. Build includes strict TypeScript and the locked 18-route canonical contract. Lint is required before publishing. This is not a replacement for browser interaction or real user observation.

No authentication, organization/participant permissions, API authorization, evidence/publication/provenance gates, database schema, source fixture, report renderer or approval mechanism is modified. UI permission hints do not authorize an action. Original data and generated reports remain subject to the existing server controls. Original source text in English is intentional; translation is separate presentation data.

## Exact fixture and environment distinction

- Case: `project_canopy_managed_site_expansion`, Base `2.0.0`.
- Studio fingerprint: `sha256-e8df94bed5cc24a4b56093b21b24101839cd7501080d01b4bfb0f1bb7e4b3702`.
- Playable fingerprint: `sha256-4c17139f6cf47399349aeaf27a473bbcb1429e7d6a9cc3eb0766e12ab290b31b`.
- Acceptance catalogue publication was confirmed on 11 September at 11:18:34 UTC in the preceding audit. It is not a publication in Prod.
- Latest Prod catalogue read in this continuation contained 15 older versions and no Canopy Base; no pagination or truncation. Software deployment does not transfer catalogue entries, user data or approvals between Sites.
- The normal signed-in publication and live owner/reviewer path remain blocked by the unavailable browser. No users, sessions or data are fabricated to bypass this.

## Remaining requirements and demo

| Requirement | Route / role | Evidence | Status |
|---|---|---|---|
| First useful action within 120 seconds: example | First visit → normal registration → example → useful edit; new person | Earlier continuation-state tests and this candidate | Not measured; no cold registration observation |
| First useful action within 120 seconds: canonical import | First visit → registration → supplied Base JSON → inspect/edit; new person | Exact fixture and retained draft tests | Not measured |
| First useful action within 120 seconds: prompt/AI | First visit → prepared prompt → sign-in/profile → live AI preview → explicit apply; new person | Prepared demo prompt and continuation tests | Not measured; no live AI invocation |
| Preliminary report within 5 minutes | Studio → report preview; new person | Existing generated 13-page draft sample from Prod75 report renderer | Artifact verified previously; time Not measured |
| Governed PDF/JSON and independent approval | Published package → reviewed sources/proposals → run → linked evidence → snapshot → distinct reviewer | Prior local P1 fixture results, no live replacement | Not verified in Prod |
| Complete EN/RU, keyboard, mobile, refresh/back, lost network | Public and authorized screens; actual roles | Source fixes and state tests | Partial; browser acceptance pending |
| Intuitive without author help | At least 3 first-time users | 0 observed; no invitations sent | Not verified |
| Main 8–10min + short MP4, subtitles and chapters | Real published UI; genuine cold registration in first 120 seconds | Earlier prepared 9:30 EN/RU narration, prompt and planned chapters | Blocked; no recorded MP4 or timed subtitles |

Remaining report issues R01/R02 from the Prod75 audit are not closed: the preliminary sample contains all graph branches and is not a completed-session decision memo; the 13-page layout needs a shorter management summary and improved pagination. PDF/DOCX extraction also remains separate implementation work. Do not replace the Help video, poster or durations with a planned script or synthetic frames.

Continue normal publication, live acceptance and recording when the browser is available; do not repeat the accepted Base restoration or recreate the source packet. The one-purpose background automation remains disabled. No third-party messages, invitations, audience expansion or new Site creation are part of this continuation.

## Additional build gate finding

C09 (P1): the initial Studio entry was 327,523 bytes, exceeding the existing 325,000-byte gate. The gate previously selected the first matching chunk filename; retained old chunks in the preceding archive could mask the active entry's size. It now reads the current build manifest. The feedback form is loaded only when requested, preserving its request payload, privacy checks and keyboard behavior. Revalidation must confirm the existing limit without raising it. This is a bundle-size measurement, not proof of the 120-second onboarding target.
