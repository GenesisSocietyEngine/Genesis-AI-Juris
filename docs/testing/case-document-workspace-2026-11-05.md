# Case and document workspace refactor — 5 November 2026

## Intent and starting state

User requested a Filevine/NetDocuments-inspired refactor of CaseVant case/document editing and management. References: Filevine's document management product and NetDocuments' document/knowledge management experience. Adapt the interaction patterns to CaseVant branding and existing permissions.

Started from canonical main and Sites v179 source `88eec428f922aec28fef37f95b9014c38156a6f6`, clean isolated checkout, task branch `codex/case-document-workspace-20261105`. Previous task checkouts and user browser tabs are untouched. Public audience and DB/DOSSIER_DOCUMENTS bindings retained.

## Acceptance before implementation

- Studio materials: compact searchable inventory, a dedicated reader alongside the list, exact source/version identity, full literal text and matching passages, direct working-record editing, unchanged guarded batch attach/download. Compact node evidence and attachment confirmation remain available.
- Case catalogue: dense, legible metadata columns and direct Overview/Sources/Decision entry using existing saved-case IDs and guarded restoration.
- Team documents: searchable document inventory alongside existing exact-version metadata/history and review controls; upload remains explicit, permission-gated and preserves form buffers. No fabricated preview of files whose bodies are unavailable.
- Desktop/narrow EN/RU where supported, keyboard focus and long names. Search/reading must not mutate source bytes, grant review, save automatically or change authorization.
- Relevant handler/regression tests and types, rendered review, normal repository integration and exact-source release checks. Record failures and unavailable checks separately.

## Preservation boundary

No schema migration, original-file editing, source factory changes, automatic approval, bulk deletion, external document integration, PDF renderer change or expanded sharing. Existing sources and immutable versions retain their exact identity. Working text edits use the existing Studio editor and ordinary explicit Save.

## Evidence

Implemented the inventory/reader, case-section links, dossier document selection and first-class AI case-flow navigation. The AI destination uses the existing prompt/proposal/review/apply capability; no new provider processing or task execution is claimed. The full-library search now intentionally starts open under this new refactor; compact node search and source-history/technical disclosures remain closed. This supersedes the earlier blanket closed-disclosure presentation check for the full library only.

- Strict TypeScript passed; changed-component lint passed before the final reader scroll refinement. Portable production build, tax asset verification, migration statement checks and mobile contract lock passed. Final changed-file rechecks are in progress.
- Fifty material/catalogue/overview regressions passed. Fourteen dossier/source-review regressions passed. The new real-component document interaction check passed: duplicate titles preserve IDs, filename/status filters compose, an exact incoming target escapes stale filters, review uses the selected document identity, and a case change clears filters. The first harness run needed the existing `.module.css` empty-loader convention; this was a harness issue, subsequently corrected.
- Real local browser, synthetic Project Canopy: D01 v1 opens in the dedicated reader with literal source text and title focus; `450 packs` gives two matches and exact passage excerpts. D01 → N02 case record → Sources restores the query, selected reader and linked-button focus. Russian navigation/material counts render correctly and switching language clears the prior reader scope.
- Desktop screenshot inspected at the normal viewport. Actual 390 × 844 viewport inspected with a long D07 title and search excerpt; document width 375 CSS px equals scroll width 375, without horizontal overflow. The layout stacks inventory and reader. Saved-case and authenticated organisation production browser acceptance remain unperformed; component/contract evidence is not a substitute for those checks.
- Complete local suite is running. Its manifest identity check detected source changes after the initial build; rebuild the final committed tree before exact-build acceptance. No deployment is claimed by this checkpoint.
- MyCase dashboard, case setup and case details were inspected read-only. Windows locked before deeper screens; official sources support the remaining parity inventory in `../development/MYCASE_PARITY_AND_AI_FLOWS.md`. No MyCase business record was submitted by the agent.

The Linux-only dependency helper requires `flock`; Windows uses the same pinned lockfile via npm ci without altering package inputs. Local runtime is Node 24.22.1; canonical CI pins Node 22.23.2/npm 10.9.8 and remains the release authority. No credentials or user case data are included in fixtures.
