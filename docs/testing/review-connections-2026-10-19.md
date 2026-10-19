# Review and connection remediation — 19 October 2026

Base: canonical main `f03890445cd985b1535cc4f267b05888ba506ed3`; live Sites v146 source `4b32993283c03f7b02d7c5f1edc27230d19a4d62`. Isolated clean checkout, branch `codex/review-and-connections-20261019`, owned by this task. Existing older checkout is untouched.

Acceptance before implementation:
- Reports' Review needed is a keyboard-operable action to the existing focused Review actions. Submission blockers have a visible next step.
- Connection selection persists until explicitly added; existing incoming/outgoing connections are visible. Duplicate destinations are labelled, never added twice. Draft changes still require ordinary workspace Save and retain undo/reopen contracts.
- Actual node-specific validation issues receive red frames plus non-colour labels and inspector explanations. Case-level context review never paints unrelated nodes. Connected-but-unreachable nodes and missing route starts receive accurate instructions.
- Preserve every existing case, schema, authored record, source fingerprint, independent approval and access guard. Review desktop/narrow EN/RU and meaningful regression tests.

Infrastructure: Sites source-opening helper attempted before edits, but its Git endpoint failed DNS resolution. Current canonical GitHub source was fetched successfully. Publication remains pending supported Sites source synchronization.

Implementation review:
- Reports has a native Review needed button and a correction CTA; private submission opens the existing visibility control without changing it.
- New deferred inspector panel separates current incoming/outgoing connections from an explicit add operation. The selected value is pinned through paging and a successful add; existing outgoing targets are excluded from additional choices, the selected connected target remains labelled, and undo re-enables adding it. Uses the existing write/history path.
- Route warnings carry exact affected IDs. No-start route failures have a specific Trigger action, preserving existing server rules. Context review is case-level, so it does not paint every node. Map/list/expanded views use red borders plus text; the inspector explains corrections.
- No source factory, model schema, API, database, publication rule, evidence acceptance or approval changes. All 42 and earlier cases remain untouched.

Measured validation so far:
- Pinned Node 22.23.2 TypeScript passed; focused lint: no errors, seven pre-existing JurisApp unused-symbol warnings.
- Initial focused cohort: 15 passed; continuity/revisions/editing/authority/category/integrity cohort: 71 passed. Added actual EN/RU action-destination test; final five-test remediation suite passed. Cohorts overlap; do not add repeated suite counts.
- React review: panel is deferred, state scoped to case/account/node, selected options stay mounted, native labels/buttons/status feedback, no automatic write on selection. Diff whitespace check passed.
- Full local Worker preview failed with Windows GetFinalPathNameByHandleW access denied. A UI-only preview compiled, but localhost requests timed out, so rendered desktop/narrow/browser acceptance remains unverified. This is not a successful hosted save/reopen check.
- Sites endpoint DNS subsequently recovered. Automatic approval review then rejected credential stdin to the supported source helper (sandbox_approval is disabled). No supported source opening or publication succeeded. GitHub contributor source delivery is independent of that gate.
