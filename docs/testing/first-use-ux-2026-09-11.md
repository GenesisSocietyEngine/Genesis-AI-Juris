# First-use UX continuation — 11 September 2026

This continues the investor-oriented audit against three practical goals: a
clear first impression, a useful first action within 120 seconds, and a
discoverable preliminary analytical report. These are acceptance targets,
not measured results or statements attributed to an investor.

## Confirmed friction and changes

| ID | Priority | Source-evident problem | Change |
|---|---|---|---|
| I01 | P2 | A new signed-in user could select the primary Continue action before confirming the profile, then return from AI to Account again. | Profile confirmation is the primary completion action until a profile exists. Optional exploration is explicitly secondary. |
| I02 | P2 | JSON import retained the old workflow stage. Markdown import could replace an invisible prompt on a later stage. Failed JSON selection also cleared transient editor state. | One visible picker accepts Studio JSON, canonical Markdown and text. Successful JSON validation opens the map, including same-ID reimports; an empty draft still opens Brief. Prompt loading opens and focuses Brief. Failures preserve the current work and stage. |
| I03 | P2 | The first PDF preview followed the entire expert settings form. | Preview and Download appear before optional settings. The user sees the selected report profile, draft/final status and audience; developer mode opens all settings. Required access/readiness messages remain visible. |

JSON routing happens only after existing identity, fingerprint and protection
verification. It does not grant edit/export rights to inspection-only imports.
Prompt files are fully read and checked before replacing the prompt. Canonical
Markdown retains the explicit Verify → review → Apply sequence. No AI request
is made by file selection. The full text and whitespace are preserved.

Report options, independent-approval boundaries, output receipt binding,
redactions and final/client readiness checks are unchanged. The economics
checkbox now describes the dedicated analysis and assumptions; it is not a
graph-redaction control. The economics-exclusion defect in the brief was
already fixed in published Site 77 and has EN/RU regression coverage.

## Verification

- Strict TypeScript, production build, lint and patch hygiene pass.
- Focused run: 31/31 tests covering onboarding continuation, guided workflow,
  prompt import, rendered report controls, Studio regressions and economics
  selection.
- Additional gate run: 41/41 tests covering the built assets, auth and
  protection boundaries, existing release checks and the new import/report
  tests. The two runs overlap and are not a combined test count.
- The full preceding candidate passed 586/586 tests. The complete suite for
  this UI candidate is required before publication; its final result is
  reported with the deployment receipt.
- Independent source review found no additional concrete regressions.
- React review retained conditional loading, event-driven transitions,
  visible keyboard focus and the dialog focus boundary, including its new
  settings summary. No dependencies, API routes or schema change.

## Acceptance still open

Browser control remains unavailable after repeated connection timeouts.
Automated and source checks do not establish visual appeal, actual keyboard
interaction, mobile behaviour, successful cold registration or completion
within two minutes. The three start routes still require real observation.

The planned 8–10 minute screen recording, short cut and synchronized EN/RU
captions remain unrecorded. Existing Help media is retained. The recording
must show actual registration, a preset case, canonical/prompt import and
report generation; a script or synthetic frames cannot replace that evidence.

Canopy's exact Base publication in Acceptance does not place it in the Prod
catalogue. Normal authorized publication and a genuine owner/reviewer journey
remain required before claiming a production Canopy demonstration.

This continuation changes the UI, not the PDF renderer or its approved image
baseline. It does not claim a new Windows/native CI result or a completed
commercial-readiness audit. Rollback is the previously saved Site 77; no
schema/data migration is introduced.
