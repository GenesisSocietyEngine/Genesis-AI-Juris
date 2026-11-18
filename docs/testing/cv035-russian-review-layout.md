# CV-035 / CV-040 — Evidence localization and review layout

## 18 November 2026 — audit and implementation

Baseline: public Sites v226, canonical runtime `1c33529a23f26017fc9d6efcd35157c03c9c3b2a`, Sites source `2242974054e968321f9c778a61f2c07e74acb626`. The official helper opened the current public Site before editing. The isolated task branch starts from documentation commit `ff5e55ecc0e655293a552257330415da37cbad00` (#322), preserving its v226 receipt. Existing release checkouts and unrelated work remain untouched.

The signed-in owner audit reconfirmed English generation/disclosure, manual evidence, proposal controls, source labels and audit events inside Russian navigation. The accepted proposal led with raw JSON and squeezed its note into half of a narrow card. A 390 × 844 live audit view had no horizontal overflow, but remained partly English.

### Changes and preservation

- CV-035: Russian Evidence forms, disclosures, statuses, citations, review controls, known audit events/roles and locale-specific audit dates. Saved receipts are translated at render time, including bounded generation counts; language switching does not rerun an action. Known error messages switch immediately; unknown server wording remains intact in technical details beneath a localized explanation.
- CV-040: readable statement first for known v1/legacy statement objects; original payload remains in an accessible disclosure. Unsupported/malformed/future payloads remain visible as their original text. Review notes span the full card. Available workspace width governs stacking, including with the case picker open. Source forms/registers adapt similarly. The picker title no longer breaks within a word.
- No changes to server authorization, mutation payloads, source versions, model receipts, review decisions or authored content. Language changes retain controlled review drafts and existing exact citation targets.

### Local evidence

- TypeScript check and focused ESLint passed.
- Integrated existing workspace and new localization tests: 26 passed before the added count/error regression. Final focused result is recorded below before integration.
- Real integrated parent with synthetic transport: RU→EN→RU retained an unsaved review note and edited JSON. Saved and stale notices switched immediately in both directions. No fixture POST was sent. Original JSON expanded/collapsed, statement, quotation, accepted history and provenance remained inspectable.
- Desktop 1280 px: expanded picker stacks review cards (667 px card, 629 px note); collapsed picker permits readable side-by-side cards. Phone 390 × 844: EN and RU stack cards with no document overflow (375 px document width, 301 px card). This is local component/browser evidence, not production acceptance.
- Screenshots: [expanded RU](receipts/cv035-cv040/local-expanded-ru.png), [mobile RU](receipts/cv035-cv040/local-mobile-ru.png).

### Integration and live gate

Implementation is not yet released. #322 has an iOS CI recurrence: the original run timed out on launch; retry reached the incomplete-write phase but launch did not return a PID. Its other trigger passed. The simulator-smoke retry follows a Flutter setup download timeout. No CI requirement was weakened. Integrate through green checks, then verify the existing accepted synthetic version-2 fixture on production in EN/RU, including source focus, audit, reload and narrow layouts. CV-010/028/029 still require an active test client; no new invitation or review mutation is part of this iteration.
