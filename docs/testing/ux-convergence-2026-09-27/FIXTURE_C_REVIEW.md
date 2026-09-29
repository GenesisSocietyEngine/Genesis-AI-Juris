# Synthetic fixture C — local implementation checks

Date: 27 September 2026. Candidate: the uncommitted UX worktree based on `bf5799383a52b6617cd9d4a0acf47af780086218`. This pass changes only tests and evidence/documentation. No application, schema, hosted record or approval changed. Root owns the final application/build identity after its separate modal correction.

## Intended result and model boundary

Before adding the tests, the intended result was to exercise synthetic fact, assumption, contradiction and missing-source states together; preserve identities and review distinctions; route known gaps to actual objects; and show source/input changes invalidating outputs without fabricating approval or semantic recalculation.

Dossier already has typed professional assertions, source anchors and explicit review/readiness states. Studio has authored graph facts/evidence and text references; editing a graph node does not create Dossier review authority. The fixture keeps those models separate. No registry, new assertion type or automatic conversion was added.

## Prepared fixture

`tests/ux-fixture-c.test.ts` defines reproducible in-memory fixture `dossier_ux_fixture_c`, revision 6. Every statement is marked SYNTHETIC.

| ID | Test state | Expected distinction |
| --- | --- | --- |
| `assertion_c_fact` | Fact: synthetic reviewer recorded 300 signed commitments in v1; accepted with `anchor_c_v1` | Retain the existing synthetic reviewer/source metadata |
| `assertion_c_assumption` | Another 150 may arrive; assumption, needs_review, no reviewer | Do not promote to fact or approval |
| `assertion_c_conflict` | Another claim says 600 signed; contradiction, needs_review | Correct through `/evidence/contradictions/assertion_c_conflict` |
| `assertion_c_gap` | Historical accepted test assertion with its source missing | Missing provenance remains visible at `/evidence/assertion_c_gap` |
| `anchor_c_v1` / `document_c` | Anchor points to immutable `version_c_1`, initially current | A later version cannot silently rewrite the earlier reference |
| `output_c` | Snapshot revision 6; reviewer approval false | Completeness must not create approval |

These are diagnostic read-model inputs, including a deliberately incomplete historical assertion. They do not claim that the live creation API permits bypassing source/reviewer checks. No API write or actual professional review event occurs.

## Actual implementation exercised

The three new tests call production functions, not mirrored implementations:

1. `normalizeAssertions` retains all IDs, types, review statuses and reviewer distinctions. `dossierReadinessFindingsFromFacts` and `computeDossierReadiness` derive contradiction, missing-source and missing-approval reasons. `safeMatterLink` and `destinationForDeepLink` preserve the exact correction object and Evidence destination. Projection does not mutate the fixture.
2. Linking the missing assertion to its synthetic existing anchor in a cloned input clears only that source gap. Contradiction and approval blockers remain. Changing the current document to v2 and dossier revision to 7 produces `SOURCE_VERSION_STALE` for the retained v1 anchor and `OUTPUT_STALE` for the revision-6 output; the earlier output and approval state remain unchanged. This checks the projection of an authoritative state change, not a browser or server-write journey.
3. A separate editable Canopy working copy follows the real gap target and `appendConnectedStudioItem`. One explicitly synthetic unreviewed evidence item connected to `demand` satisfies the existing two-record structural check. `studioOverview` then reports **Requires reassessment**, no invented recommendation, and `not_recorded_in_studio` for human review. An actual earlier report model/layout/presentation receipt becomes stale through `isReportReceiptStale`. The reference draft remains unchanged.

Existing Overview tests additionally cover model/input/route/version invalidation, exact and unavailable source references, focus callbacks, EN/RU rendering and generic/empty states. They remain executable/component evidence, not a complete browser route.

## Controlled failure and recovery

The focused invocation also executes existing production NavigationController and StudioSessionAuthority checks with controlled transports: pending-work locks, failed/wrong-actor switches, 401-to-500 concealment, delayed-success rejection, explicit recovery, failed-logout Retry, and 503/network/timeout/malformed-identity denial without further private reads. Existing Matter view-model checks distinguish permission, stale revision, unsupported operation and generic errors without false Saved status.

These close only those executable controller/state subchecks. A02's complete Studio loading/error browser matrix, real hosted interrupted Save, natural expiry and two-window conflict remain separately unperformed. Simulated transports are not hosted acceptance.

## Results and limits

- **PASS 63/63**, zero skips/failures on pinned Node 22.23.2: new fixture tests plus studio-overview, dossier-readiness-server, dossier-workspace-ui, studio-session-authority and sidebar-navigation. [Focused log](evidence/fixture-c-tests.log).
- First typecheck found four missing required report-option fields in the new test. Only the test options were completed with the exact current publication fingerprint and null/nonpersistent receipt settings. [Initial diagnostic](evidence/fixture-c-typecheck.log) retained; [3/3 retest](evidence/fixture-c-retest.log) PASS.
- Full strict TypeScript and scoped ESLint both exited 0 with no stdout/stderr. [Typecheck receipt](evidence/fixture-c-typecheck-retest.log), [lint receipt](evidence/fixture-c-lint-retest.log). Scoped patch hygiene passed.

Implementation and self-review: baseline-discovery agent; final independent integration review: coordinator. Fixture preparation and bounded executable checks are now performed. Actual browser correction journey remains **NOT_RUN** unless a later browser record supplies it. No hosted persistence, human comprehension or completed independent professional approval is claimed.
