# Case intake forms — 8 November 2026

## Baseline and reference

Started from clean canonical main `74accd4213d7f6fe1e0611f67915e1aa27868aaf` after the contacts release; both the existing public site and Sites version ledger identified v196. The final CRM documentation run [passed](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42367869388). Intake was the next item in the [comparative roadmap](../development/MYCASE_COMPETITIVE_CYCLES.md).

Signed-in, read-only MyCase inspection: Documents → [Intake Forms](https://maxima-consult.mycase.com/forms) opened a tracker for forms across cases, outstanding follow-up and downloading completed forms. The trial showed its empty state. Documents → [Templates](https://maxima-consult.mycase.com/documents?template=true) opened a distinct Word/eSignature/Advanced catalogue with a merge-field reference, upload command and versioned titles. These observations establish the navigation and intended workflows, not MyCase’s internal storage or permissions. No MyCase records were submitted or copied.

## Acceptance and scope

The firm can design a named, reusable questionnaire with required and optional questions. Staff can select an authorized case, save incomplete answers, reopen a draft after reload, complete it, read the answers and download them as text. A saved form retains the exact questionnaire revision. Editing or archiving a questionnaire affects future forms only. Restoring a questionnaire and reopening a completed form each create a new revision. Case participation, case status, Studio identity, information requests, documents, reports and evidence remain separate.

Intake is internal staff work in the existing synthetic/de-identified environment. Saving sends no client invitation or email. External filled forms, client portal, signatures, Word templates and merge fields are separate capabilities. Earlier form revisions are preserved; the reading pane displays the current version.

## Development verification

- Real route and database checks cover an incomplete draft, required answers, immutable history, archive/restore, completion/reopening, obsolete templates, stale edits, duplicate/lost saves, cross-origin writes, foreign organization, auditor and case-access denial. Receipt readback matches the selected organization, actor, operation, record and revision. The case grant is rechecked in the same database batch as the write.
- Controller checks exercise save-before-departure, identity expiry, a mismatched receipt, recovery without duplicate submission, retained questions on a conflict and removal of a draft when its case grant disappears.
- In a browser connected to an isolated local D1, created a two-question questionnaire; started a form with the current governed case preselected; saved an optional answer while completion was disabled; reloaded, supplied the required answer and completed it. The reading pane showed 2/2 and the download produced a text file. The case banner retained the governed case and the saved Studio return. The blank editor focused the name input and disabled Save. Russian labels rendered in the populated workspace. At 390 CSS pixels there was no horizontal page overflow and New intake form, Reopen as draft and Download answers each measured 44 px.
- No production case write is needed for this audit. Production evidence is recorded separately after publication.
