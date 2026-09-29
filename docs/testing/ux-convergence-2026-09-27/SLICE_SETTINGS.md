# Stage 1–2 slice: case-type guidance and technical details

27 September 2026. Implemented after the stage/UX reconciliation was delivered. Scope: UX06 routine technical language and the runbook's explicit Tax planning / Tax & compliance choosing guidance. Base HEAD is `bf5799383a52b6617cd9d4a0acf47af780086218`; this slice is uncommitted and not deployed. It changes the application inputs after the earlier `849295fa…` build, so that build's browser observations are not acceptance of this slice.

## Outcome and acceptance defined before implementation

- Ordinary expanded case settings and playbook output guidance use readable labels; V59, package IDs/versions, pinned definition, workflow code and Rust implementation terminology remain available inside explicitly named, default-closed **Technical details** disclosures.
- Tax choices explain a difference supported by their existing playbooks. The existing `tax_compliance` playbook includes a compliance schedule (reporting, approvals, owners and effective dates); `tax_planning` offers the tax position memorandum and economic assessment. No new capability or tax advice is promised.
- Selector, playbook and Templates use the same displayed guidance in English/Russian. Keep all nine type IDs, selection callbacks, disabled/radio state, registry contents, AI/governance/report inputs and template-generation behavior unchanged.
- Review the source diff and run meaningful existing package/type/template checks. Actual rendered expanded settings, disclosure keyboard behavior and narrow/long-copy layout require the coordinator's browser acceptance; source/static output alone cannot establish those.

## Implementation

- `app/case-type-presentation.ts`: a pure presentation adapter with a type-only playbook import. It supplies two tax summaries and displays the English `Tax & compliance` label without the literal escaped ampersand retained in the immutable JSON. Other labels/summaries fall through unchanged.
- `app/StudioCaseTypeSelector.tsx`: the normal heading is Case type; primary result stays visible. ID/version, raw workflow mode and pinned definition move into Technical details. The same `definition.id` still drives key, radio selection and `onChange`; existing permission disabling is untouched.
- `app/StudioCasePlaybook.tsx`: ordinary intake reads Case guidance; output heading reads Case outputs. Intake/output package identities and the historical V59 marker are disclosed, and Rust implementation terminology is disclosed only for an existing playable-route requirement. Existing questions, checks, AI-focus guidance, output list and assessment counts are unchanged.
- `app/CaseTemplates.tsx`: card labels/summaries and their accessible button suffixes use the same adapter. `prepareCaseTemplate`, prompt contents and `onStart(definition.id)` are unchanged.

No registry JSON, package definition, case ID, schema, saved data, server authority, report renderer, AI instruction, fixture, dependency or migration changed. Native `details`/`summary` adds no effect, event listener, storage or network action. The React checklist was applied for direct imports, simple render-derived presentation, semantic controls and unchanged event ownership; no unnecessary memoization or state was introduced.

## Verification receipts

- **PASS, 17/17, zero skipped:** existing `case-type-registry`, `v59-case-type-playbooks`, `help-training-navigation`, and `demo-catalogue` tests on pinned Node22.23.2. [Host TAP log](evidence/slice-settings-tests-host.log). These cover immutable nine-type registry, legacy fingerprint behavior, actual package rules, AI provider context, template preparation and both-language template rendering.
- First sandbox attempt failed before application tests with `uv_os_get_passwd ENOMEM` while importing tsx. [Original diagnostic](evidence/slice-settings-tests.log) retained; the approved host retry above passed. It is not an application regression or a waived assertion.
- **PASS:** scoped ESLint for the four changed modules, exit0, no stdout/stderr. [Empty success log](evidence/slice-settings-lint.log). Scoped `git diff --check` passed.
- **PASS preservation check:** `git diff --exit-code` confirms `case-type-registry.v1.json`, `case-type-playbooks.v1.json`, `case-type-registry.ts`, `case-type-playbooks.ts` and `case-type-reference.ts` remain identical to HEAD. No tests were added solely to match the copy, and no existing assertion changed.
- **PASS:** full strict TypeScript check, `--noEmit --incremental false`, exited0 with no stdout/stderr. [Empty success log](evidence/slice-settings-typecheck.log).

Independent read-only source review by `report_verification` completed with no material finding in these four files: [review](SLICE_1_3_INDEPENDENT_REVIEW.md). It checked preserved ID callbacks/data, default-closed native disclosures and the actual additional compliance-schedule output; it did not duplicate the execution checks. Browser verification is the coordinator/browser agent's work; no rebuild or commit was performed by this agent while the existing worker was active. This bounded source slice does not complete stage1/2's full loading/error, cross-route, role or human criteria.
