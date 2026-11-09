# CV-001 — Case overview and AI Studio, 9 November 2026

On v203, entering Studio from a team case hid the case name and the suite’s Case overview command opened a personal analysis. This amendment keeps the two records separate. The team case is the subject of navigation. The workpad is a personal Studio draft and saving it does not attach documents, populate a team record or share anything with the case team.

| Journey | Observed in the isolated browser with real handlers and a migrated database |
| --- | --- |
| Team case → Studio, no linked draft | The Outlook-style header names the active team case above “Untitled Studio draft.” Save explains the minimum content and the location under Cases → Personal → Saved Studio drafts. |
| First save and return | Gave the draft a title, added one Trigger and chose Case overview → Save and continue. The case overview reopened. Choosing AI Studio there restored that exact new title and a confirmed saved status. No team-case ID was used as a draft ID. |
| Existing personal draft | The team name and distinct draft title were visible together. Draft overview stayed inside Studio; the suite’s Case overview reopened the team record. Returning to Studio reopened the same saved draft. |
| Unsent input | Case overview displayed the departure warning. Stay here kept the unsent text; after clearing it the same case opened. Typing a prompt never confirmed a draft save. |
| Change case / narrow and Russian | The second selected case opened a clean workpad. At 390 × 844, the Russian workbench distinguished a saved draft from an untitled one after switching. The case label fit, the save guidance was visible and there was no page-level horizontal overflow. |

The identity read returns only an authorized case ID and title. It checks membership/participation before returning, uses a private, non-cacheable response and does not write. A separate account could not read a foreign case; unauthenticated and invalid selections were also tested. The client drops stale reads on scope/authority changes. The team title is not stored in a browser backup, a saved draft payload or an outgoing URL. A case-scoped visit without a draft does not open or clear an unrelated device draft.

The navigation, Studio and preservation group passed 83 tests; the D1 access test passed separately. After the first-save UX change, a further 53 tests covering save receipts, incomplete drafts, case switching and device archives passed (overlapping groups, not additive). The browser used synthetic records only. Production release and live acceptance are tracked in [current progress](../../current_progress.md) and [the backlog](../development/development_backlog.md); integration alone is not production verification.
