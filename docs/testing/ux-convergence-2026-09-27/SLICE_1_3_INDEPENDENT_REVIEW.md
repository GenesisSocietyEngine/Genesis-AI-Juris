# Stages 1–3: independent review of the bounded follow-up slice

Reviewed 2026-09-27, initial source checkpoint **18:10:56 UTC**, followed by the content-order fix at **18:11:59 UTC**, in the uncommitted UX worktree based on `bf5799383a52b6617cd9d4a0acf47af780086218`. This review concerns the new display guidance and governed-evidence handoff, not a fresh acceptance of every earlier Stage 1–3 change. The runbook is the supplied requirements artifact; implementation scope came from the coordinator's explicit assignment.

## Outcome and review scope

The intended outcome is to keep technical version details at a secondary level, distinguish the two retained tax choices using their actual outputs, and provide an actionable route from Studio Sources to the existing authorized Matter evidence workflow without creating a second assertion model or associating cases by title.

Reviewed application files, without editing them:

- `app/CaseTemplates.tsx`, `app/StudioCaseTypeSelector.tsx`, `app/StudioCasePlaybook.tsx`, `app/case-type-presentation.ts`.
- `app/StudioSourcesPanel.tsx`, `app/studio-governed-evidence.ts`, `app/studio-overview.module.css`.

Supporting reads included the unchanged case-type registry/playbooks/reference helpers, `workspace-navigation.ts`, `use-interface-locale.ts`, `NavigationSession.tsx`, `departure-click.ts`, and the current My cases/Matter catalogue and Evidence UI. The reviewer did not execute a browser, mutate a case, call an authenticated API, or rerun the coordinator's tests.

## Findings

**No material identity, authorization or state-preservation defect was found in the reviewed source.** The following conclusions are source-review conclusions, not browser or server acceptance:

| Criterion | Result and reasoning |
| --- | --- |
| Existing IDs and content | **PASS, source scope.** All template and radio callbacks still pass the existing `definition.id`. `prepareCaseTemplate`, classification/reference types, playbook checks, output arrays, registry JSON and associated registry/reference functions are unchanged. A read-only `git diff --name-only` for those registry/playbook/reference inputs returned no changes. |
| Technical details secondary | **PASS, source scope.** Case-type ID/version, workflow mode, pinned definition, `V59` and the implementation-specific Rust wording move into native `details` elements without an `open` attribute. Professional output names and functional playable-route requirements remain visible. Native disclosure keyboard behavior is retained; actual focus and geometry need browser observation. |
| Tax choice clarity | **PASS, source scope.** The new pure presentation helper changes display text only. Tax planning describes the memorandum/economic assessment. Tax & compliance additionally describes reporting, approvals, owners and dates, matching its existing `compliance_schedule` output. English display removes the registry's literal escaped ampersand, while persisted registry text and generated intake prompt remain unchanged. |
| Explicit originating case | **PASS, source scope.** The helper accepts a safe same-origin return path, requires its pathname to be `/matters`, requires a nonempty bounded dossier value, and checks organization equality before adding `dossier` and `section=evidence`. It does not read draft title, graph content, custom-case ID or saved-case receipt. The UI explicitly says the draft remains separate and is neither copied nor linked. |
| Generic and switched-organization routes | **PASS, source scope.** The target starts from `/matters?collection=team`. Any dossier inherited by the general navigation helper is deleted, including a Canopy context. Missing/invalid return paths and organization changes fall back to the catalogue, with neither a dossier nor an Evidence section. New targets do not retain stale target/request/hash values. Current organization/language context is preserved by the existing navigation helper. |
| Case-catalogue behavior | **PASS for honest handoff wording; existing behavior retained.** `MattersClient.loadCatalogue` can select the first authorized case when no dossier is specified. The new generic copy asks the user to choose the intended Team case and then open Evidence; it does not claim the first case belongs to the Studio draft. The generic route deliberately omits `section=evidence`. |
| Dirty-work guard and history context | **PASS, source scope.** The control is an ordinary anchor. Existing `NavigationSession` capture applies its registered workspace departure check to this link. The Sources panel uses `useWorkspaceLocation`, which subscribes to history and interface-location updates; it does not retain a one-time URL snapshot. Modified/new-window clicks preserve the existing behavior. No new departure override or storage side effect is introduced. |
| Server authorization | **PASS, source scope.** The new helper only constructs navigation hints. There are no new API calls, permission mutations, claims of preauthorized access, or alternate data reads. Existing destination authorization and role checks remain responsible for access and review. This does not prove a particular actor currently has access. |
| Existing source model | **PASS, source scope.** The retained fictional packet and graph records remain explicitly distinct from accepted Matter anchors and reviewed assertions. Exact source/version/section opening is unchanged. Existing Evidence UI already has facts, assumptions and contradictions; missing anchors remain visible; current-version warnings and accepted/rejected/superseded review actions remain in their original model. A real authorized browser correction journey is still required for the outstanding A04 acceptance scope. |

### Content-order finding and resolution

The initial Sources version inserted a heading, two explanatory paragraphs and the new action before the first graph record or retained source reference, following the existing header, counters and provenance explanation. The reviewer flagged the increased explanatory material before content against the runbook's “opens on content” requirement.

**RESOLVED in source:** the coordinator moved the handoff after the actual Recorded facts and evidence block and shortened its introductory copy. The reviewer read the corrected file at 18:11:59 UTC; existing first-record content now precedes the new explanation/action. No material source finding remains in this bounded slice. No overlap, clipping or viewport-height pass is asserted from source inspection alone: actual Sources geometry at 1366×768 and a narrow Russian layout remains a browser check. The fix does not change the routing/authorization conclusions above.

## Available execution evidence and limits

- The presentation implementer ran the existing case-type registry, V59 playbook, help/training navigation and demo catalogue selection: **17/17 PASS**, zero skips. The reviewer read the completed [host TAP receipt](evidence/slice-settings-tests-host.log). The earlier [sandbox receipt](evidence/slice-settings-tests.log) records the pre-test Windows user-info/`ENOMEM` failure and is not a product test failure.
- The presentation implementer reports scoped ESLint exit 0 and diff-check success; the [ESLint output](evidence/slice-settings-lint.log) is empty. This reviewer did not independently repeat that command.
- The presentation implementer's full strict TypeScript check subsequently completed with exit 0; the reviewer read [its recorded scope](SLICE_SETTINGS.md) and confirmed the [empty success log](evidence/slice-settings-typecheck.log).
- The coordinator's targeted handoff routing, actual Overview/Sources component, onboarding and Canopy continuation checks completed **29/29 PASS**, zero skips. The reviewer read the completed [TAP receipt](evidence/reconciliation-handoff-tests.log) after the content-order fix. This is executable/component evidence, not an authenticated browser handoff.
- **NOT_RUN by this reviewer:** changed-layout browser inspection, ordinary anchor + dirty-draft interaction, actual authenticated Matter access/readback/review, assistive-technology use, or deployment. Existing earlier browser results do not automatically cover this changed layout.

These application edits supersede the earlier frozen application identity for a later build. The prior `849295…` candidate receipt is historical and must not be relabeled as containing this slice.

## Reviewed source checkpoint

| Path | SHA-256 |
| --- | --- |
| `app/CaseTemplates.tsx` | `9ee269adc6bfdac37de63e127fc20db596c41c41b50703fc2850d005ad4aba38` |
| `app/StudioCaseTypeSelector.tsx` | `3ce6d7e7af8a63563493cf6db5821167e08355b1b1afd6dd4d746b53f79e5957` |
| `app/StudioCasePlaybook.tsx` | `59975eab9c886ccaa4961779e16a99ef2a00fe521294f9102e3182566eb63a03` |
| `app/case-type-presentation.ts` | `415a4528c8560a2a09e86268b58567f090d73f83c8520fa7a855d87fe42c3dc9` |
| `app/StudioSourcesPanel.tsx` (after content-order fix) | `3739b4527f00f420e737658dce8e1a46a14acea3da73ea123288502047753fe7` |
| `app/studio-governed-evidence.ts` | `b9d26d5d8fa48fa05b3a56ac6aaec4af175c1ef53b7830b8093483a1250c9ae6` |
| `app/studio-overview.module.css` | `2427f1e96e4f7c3f12a650c8d80f2beb137e4acd8443e7abc66841954d26e777` |
