# UX convergence requirements — 27 September 2026

The prior implementation record stated that the user had confirmed staged implementation of the runbook. The resumed turn's direct request is “please proceed”; that earlier statement is retained as historical attribution, not a new quotation or independently verified authorization. This document maps the supplied runbook's requirements; it does not itself grant publication authority or report implementation or acceptance PASS. Local starting source was read as `bf5799383a52b6617cd9d4a0acf47af780086218` on `codex/ux-convergence-2026-09-27`. The coordinating baseline record owns current native/deployment attribution.

Inputs: `C:/Users/User/Downloads/Genesis-Juris-Codex-UX-Implementation-Runbook-2026-09-27.md`, `C:/Users/User/Downloads/Genesis-Juris-UX-Audit-2026-09-26.md`, and this checkout's `AGENTS.md`. The September 26 audit is a guest-session heuristic assessment of v102. Its unperformed checks are not reproduced FAILs; its expert perspectives are not human research results.

## Requirements and traceability

| UX ID | Required user outcome / invariant | Implementation stage | Acceptance IDs |
|---|---|---|---|
| UX01 | Home opens the Canopy Overview in at most two meaningful actions; its actual conclusion, basis and limitations are visible. The 90-second human result is measured separately. | 2 | A01, A17 |
| UX02 | Compact case header and clear Overview expose useful case content and the primary action at 1366×768/100%, including loading, empty and error states. | 1–2 | A01, A02, A14 |
| UX03 | Sources & evidence begins with documents/versions, claims, assumptions and gaps; case settings remain available at a secondary level. | 3 | A03, A04 |
| UX04 | Document count, linked claims and reviewed grounds are distinct. Canopy's nine-document description and actual records are reconciled without changing a counter to simulate completeness. Each gap opens its actual object. | 3 | A03, A04 |
| UX05 | Graph overview/detail/list and fit/expanded views make the route and outcome readable while preserving IDs, order, edges and training behavior. | 4 | A06, A14, A15, A16 |
| UX06 | Ordinary work does not require developer mode, schema/version codes or pinned-definition terminology. Technical detail remains accessible where appropriate. | 1 | A01, A02, A16 |
| UX07 | Advisory authoring does not ask for player choices, difficulty or catalogue copy. Training data, editor and simulations remain supported. | 1 | A02, A16 |
| UX08 | Before Save, guests understand sign-in and storage. Login/cancel/error/conflict/recovery preserve the intended draft and distinguish local storage from confirmed server Save. | 5 | A07, A08, A09 |
| UX09 | My cases provides coherent discovery of personal/team work while retaining distinct Studio/Matter identity, ownership, storage and access. Never merge by title or expose inaccessible counts. | 5, integrated with 2–4 | A08, A10, A16 |
| UX10 | One depth selector and synchronized tree control implement the declared Base/Medium/Full contract. Preview and download use matching settings; no stale preview revival. | 6 | A12, A13 |
| UX11 | Ordinary export has concise confirmation and expandable receipt detail. Preserve version binding and existing authorized export history; do not promise durable guest history or equate generation with file delivery. | 6 | A12, A13 |
| UX12 | Draft, ready-for-review and authorized approval are distinct, version-bound states. Disabled actions explain the actual reason and next step. | 2, 6 | A02, A11, A12, A17 |
| UX13 | From a material conclusion, reach its permitted source/version/fragment in at most two actions when that link really exists. Label text-only references honestly. Changes mark proven dependencies for reassessment. | 3–4 | A03, A05, A06 |
| UX14 | Readable typography, visible non-colour-only states, graph list alternative, measured narrow/zoom layouts, keyboard and screen-reader access support the full affected route. | 1, 4, 7 | A06, A14, A15 |
| UX15 | Studio, My cases, Account, Organizations, Templates and Help share stable labels and active context. Old deep links and browser back/forward remain meaningful. | 1 | A01, A10, A16 |
| UX16 | Data restrictions and report audience claims agree. Preserve client-data warnings until the relevant processing scope is established; no draft or synthetic check fabricates professional approval. | 2, 6, release | A02, A10, A11, A12, A17 |

Stage 0 establishes the actual baseline, supported models, existing fixtures and reproduction of UX01–UX16. Stage 7 integrates affected technical checks. Stage 8 collects real human results and records separate release decisions. Accessibility/error checks run within each changed stage, not only at the end.

## Data and feature preservation

- Keep existing demos, training simulations, case-type IDs, saved versions, source lineage and audit records. Edit separate synthetic working copies; do not rewrite a reference case to hide a gap.
- Studio drafts and organization Matters may remain distinct backend entities. A unified entry point is not automatic migration, identity conversion or a claim that Matter notes appear in a Studio PDF.
- Use stored provenance and dependency relationships. Recalculate only values supported by the real engine; otherwise mark **Requires reassessment**. A recalculation never grants approval.
- Separate material present, claim linked and human review completed. Form completion is not legal reliability. A source version change cannot silently confirm an old citation.
- Preserve auth, cross-tab session boundaries, organization/case permission checks, dirty drafts, save receipts and late-response protections. UI visibility is not server authorization.
- Distinguish same-named Personal workspaces by owner/role. Explain Member ID and reject mistaken email clearly. Add email invitations only if an authorized server identity-resolution mechanism actually exists; no guessed identity or automatic privilege expansion.
- No new providers, billing, speculative integrations, destructive migration, real-data upload or unapproved invitation is part of these documents.

## Report contract to preserve and verify

| Depth | Visual tree | Required relationship |
|---|---|---|
| Base | OFF | Enabling tree selects Medium. |
| Medium | ON | Disabling tree selects Base. |
| Full analysis | ON by default, may be OFF | Toggling the visual tree retains Full depth. |

The runbook asks to preserve a separate Full textual-appendix option if one already exists. The preexisting [report review](REPORT_DIALOG.md) records that v102 instead couples Full's visual tree with its detailed text and has no separate appendix switch. The candidate preserves that renderer contract and explains the composition; the lack of a separate preexisting control is not permission to silently change the renderer. Choosing Full initializes tree ON; switching it OFF keeps Full depth. Verify the actual files before accepting this compatibility mapping. Draft/approval, audience and confidentiality remain separate from depth. Obtain actual Base, Medium, Full ON and Full OFF files; open and visually inspect all pages. A receipt fingerprint is not a PDF-byte hash.

## Evidence and decision boundaries

[ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md) owns scenario status and evidence requirements. [HUMAN_VALIDATION.md](HUMAN_VALIDATION.md) owns A17; its blank records are not measurements.

The engineering candidate requires applicable technical criteria, relevant regression checks and the final changed-flow review. Human validation remains separately NOT_RUN until real participants complete it; that absence alone is not a blanket blocker on a technical candidate or an otherwise authorized, technically accepted production iteration. Production still needs its actual release gate, exact-source publication and smoke. External pilot GO additionally requires its human, data, permissions, operational and professional-workflow evidence. This mapping issues none of those GO decisions.

Every stage records its accepted commit/build and remaining findings. Unresolved P0/P1 in that stage prevent closure. Deferred P2 needs an owner, rationale and impact. After three unsuccessful cycles on the same defect, change the approach; do not weaken the criterion or declare PASS.

## Resumed-candidate evidence discipline

The existing component reviews and local browser report describe an uncommitted worktree with hot updates. Keep their scope and timing explicit; they are not acceptance of a later immutable build. The retained integrated regression log contains two failed tests and must be reconciled with current results. [FINDINGS.md](FINDINGS.md) tracks those failures without assuming they are production defects. The coordinator owns current scenario status in [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md) and separate candidate, production and pilot decisions in `RELEASE_DECISION.md`.

Neither this requirements map nor the historical publication notes substitute for the current user instruction, applicable project rules and actual platform authorization. No migration, credentials, permissions or production data change follows from preparing these documents.
