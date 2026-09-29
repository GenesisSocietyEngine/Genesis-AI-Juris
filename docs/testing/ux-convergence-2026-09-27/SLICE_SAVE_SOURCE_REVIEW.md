# Saved routes, conflicts and evidence handoff

27 September 2026. Continuation after the delivered reconciliation matrix. These are local candidate changes, not deployed acceptance.

## Outcome and acceptance

Preserve the requested saved-case tab while authorized data loads; preserve edits and distinguish a stale save from a network failure; give the Sources tab a useful route to the existing governed evidence workspace without inventing a Studio–Matter relationship. Keep all original capabilities and permission checks.

## Independent saved-route review

The coordinator reviewed the navigation fix written by the report-verification agent separately from that agent's implementation. Request-ID, source-draft, account-scope and current URL target fences prevent late reads from replacing a newer context. The pending state waits for this exact saved read and releases on failure; an older request cannot clear a newer one. Latest same-case tab selection is read at completion. Genuine empty cases retain their Brief route. No server authorization, draft fingerprint or copy-protection validation was relaxed.

The seven actual-handler/effect regression tests cover the relevant orderings. Their modeled browser facilities do not establish actual browser acceptance. The first live browser reproduction found the route defect; a new-build live retest is required and recorded separately. Source review: **PASS**, no remaining substantive finding identified.

## Conflict correction

Two actual browser tabs loaded the same saved version. The first save succeeded; the stale second tab retained edits but displayed a generic connection message. `readJsonResponse` intentionally drops non-success bodies, so the save handler never saw `stale_draft`. A dedicated save-response reader now parses error JSON as well as success JSON. HTTP status is still checked before the exact durable receipt validator; malformed responses cannot mark a draft saved. Existing generic success-only readers are unchanged.

The independent report-verification agent reviewed the correction. The focused response regression includes 409 stale-draft, 403 profile-required, malformed 503 and valid receipt. Browser conflict retest remains a separate acceptance record.

## Sources handoff

`studioGovernedEvidenceDestination` returns the Team case collection when no exact Matter context exists. It preserves an explicit `/matters` return destination only for the current organization, then opens its evidence section. Stale case IDs, request targets and foreign origins cannot fabricate a relationship. Canopy without a Matter context leads to the collection, not a guessed case. The ordinary link remains subject to the existing dirty-draft departure guard.

Independent review moved the handoff below the actual source records and tightened the explanation. Four routing regressions and 29 combined source/onboarding checks passed. The `7b1a…` browser pass observed the generic Canopy destination, exact same-organization handoff and Stay/Discard behavior. The source-v2 upload attempt was blocked by an unavailable browser security check and was not rerouted through an API.

## Evidence

- [Saved-route reproduction and implementation](SAVED_CASE_STEP_REVIEW.md).
- [Separate stages 1–3 critical review](SLICE_1_3_INDEPENDENT_REVIEW.md).
- [19 client regressions](evidence/reconciliation-final-client-tests-expanded.log), including account-history ordering/isolation added in the later report slice.
- [Sources routing regressions](evidence/reconciliation-handoff-tests.log).

Browser checkpoints and the final release decision identify the exact builds used; these scoped passes do not imply hosted acceptance or an entire stage PASS.
