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

## Rerun audit — 19 October, requested production rollout

Acceptance before this slice: diagnose final-head CI, correct material connection/review findings, preserve data and historical locks, update a concrete development instruction set, then use ordinary integration and the supported exact-source release path. Rechecked canonical main remains f03890445cd985b1535cc4f267b05888ba506ed3; Sites remains public v146. Work continues in the owned checkout on local branch codex/review-audit-20261019, based on PR 140 head ee9da238f3c936baa12aefb846f3283848020802; no other dirty paths existed at start.

Findings and corrections:
- CI web run 39237245242 built successfully, then failed only the historical `destinationNodeMenu.nodes.map` assertion after extraction of that control. It reported 1,623 passed, one failed, three skipped. Replaced the obsolete assertion and exercised the actual new component at 200 nodes: every unconnected destination reachable, options bounded to 12 plus the pinned choice, no write from selection/paging. The later packaged-runtime/security stages were skipped, not verified.
- The same run's PDF job passed all 47 PDFs, unchanged Full baseline, bilingual Base/Medium and tax-v2. This is evidence for that exact earlier candidate, not later-head acceptance.
- Filtering with 13 available destinations and adding the last match reduced the count to 12, hiding the search input while retaining its filter. Keep any active search visible; actual EN/RU component tests clear it and regain all remaining candidates.
- Review node actions could focus a hidden map node when List was selected. The actual action handler now switches to detail at readable zoom before selecting/focusing the exact node; case-level actions leave the map untouched.
- Invalid-only edges counted as connections in the orphan warning but not in its node IDs. Use the same valid-endpoint classification for count and red frames; a dangling-only node remains a warning.
- Oversized private drafts displayed the size blocker but offered visibility first. Visibility CTA now requires the size check to have passed, matching the blocker order.
- Reviewed React boundaries, derived state, native control labels, no-write selection and case/account/node scoping. Existing save/history/authority paths, server structural rules, schema, templates and all user records remain unchanged.

The supported source helper was retried with a fresh credential; hidden stdin was again rejected by automatic approval policy because sandbox_approval is disabled. No supported source-open receipt or deployment resulted, and no alternate credential route was attempted. A renewed UI-only preview compiled and listened on 127.0.0.1:5174, but its readiness request timed out after eight seconds; rendered desktop/narrow acceptance remains unavailable. This preview has no backend and cannot establish authenticated save/reopen.

Development instructions now point to `docs/development/CASEVANT_REVIEW_REMEDIATION_2026-10-19.md`: bounded acceptance matrix, exact current/predecessor provenance, native/static/browser release gates, preservation and rollback, and owned priorities for package carriers, account transitions, service readiness, research and source acquisition. Historical v145 retention text is explicitly scoped to its completed release; future rollout must resolve the actual predecessor.

Local rerun evidence: focused cohort 22/22 passed before the final added action-focus regression; final remediation suite 8/8 passed, including that executed-handler check. The 71-test continuity/revision/editing/authority/category/integrity cohort passed again. TypeScript passed; changed-file lint reported zero errors and the same seven existing JurisApp unused-symbol warnings. Portable build prechecks passed (typecheck, tax assets, two migration tests, 18-route mobile lock), then Vite configuration loading failed again with Windows EPERM realpath errors for vite/module-runner and react-dom. No dependency/configuration or historical baseline was changed to mask this environment failure. The owned UI preview was stopped; no user case/tab was changed. Final remote CI and delivery identity must be recorded separately.

## Verified source checkpoint; rollout still open

Functional source `5b5a545065f7955abf2688e2b7a7711417d2717d` is published on `codex/review-and-connections-20261019` in PR 140. Its remote tree `7d927dfc18e0d4181ab655a86d842b18dbf8d02d` equals the reviewed local tree; fetched checkout was clean. Canonical main remains f03890445cd985b1535cc4f267b05888ba506ed3. PR remains draft/unmerged because rendered acceptance and release are unresolved; no claim of production delivery.

[Final functional web/PDF run 39249811904](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/39249811904) succeeded. Web job 118050561645: 1,627 passed, zero failed, three inherited skips; production build, migration/type/lint/mobile lock, packaged shared Rust browser/Worker checks, packaged tax report history and complete/production dependency audits passed. Both audits found zero vulnerabilities. Verified build artifact 12185307405 belongs to this exact candidate, not merged main and not a Sites deployment. PDF job 118050561213 passed the unchanged Full cohort, bilingual Base/Medium and tax-v2 checks. Rust, Flutter and Android workflows passed; iOS Native FFI and iOS Tax Application remained running at the final observation. Do not represent those as passed or failed.

Bounded production log read (last 180 minutes, errors only, limit 25) returned two favicon 404s and one unrelated xmlrpc.php 404, with no case-save failure in that sample. This is not proof of successful persistence and caused no production changes. Production remains last-confirmed public Sites v146. Native release, both-origin retained-asset checks and changed-flow authenticated desktop/narrow EN/RU acceptance remain open. The policy rejection, Windows build limitation and preview timeout above remain the concrete blockers/verification limits. Documentation-only closure must not be mistaken for a new runtime release.
