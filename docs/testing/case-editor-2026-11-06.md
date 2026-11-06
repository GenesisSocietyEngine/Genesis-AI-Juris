# Case editor refactor — 6 November 2026

## Starting evidence and acceptance

Task owner: current CaseVant chat, existing isolated checkout `work/casevant`. Canonical main and clean local HEAD both `40ebc851e4318eb5d0d45cd19727dee05a5bb35e`; no other writer observed. Production baseline public Sites v189, runtime `32b02a03f9cd44529c309a35ffe180250e8bd973`. Branch `refactor/case-details-editor`.

Outcome: an Outlook-style, discoverable case editor with consistent commands, readable statuses and collapsed technical information. Preserve the workspace owner, case/organization authority, revision checks, other drafts, historical outputs and explicit lifecycle decisions.

Acceptance before implementation:

- Edit case is available beside case identity, with a focused, labelled form for supported name, jurisdictions, priority and confidentiality. Reference, type and owner stay read-only; do not invent unsupported fields.
- Save & close, Cancel and Keep editing use consistent sizes. Cancel requires explicit discard when dirty; section navigation retains the draft. Keyboard entry/return focus and narrow layouts work.
- Save binds the revision at the start of editing. A concurrent change keeps the user's input and offers the latest saved details; no automatic rebasing or governed user-edit merging.
- Uncertain responses are checked by authorized readback before another write. Duplicate, obsolete, read-only and revoked-access callbacks cannot write. Other section drafts survive a metadata save.
- Case status, review readiness and editor save state remain distinct, with text as well as color. IDs, revision numbers and developer controls remain under an optional technical disclosure.
- Exercise the real controller/component with synthetic transports, run relevant existing checks and final exact-main web/PDF CI. Adopt the unchanged CI build; retain only previous-current v189 assets; verify both production origins and native Sites receipt.

## Reference review

The first reference attempt was signed out. After the user signed in, freshly inspected MyCase Dashboard → Cases → its built-in sample → Edit Case on 6 November. Observed a prominent header command, focused form, case name/number/practice area/stage/date/office/description, optional custom fields, and Cancel / Save & close. Cancel returned focus to Edit Case. No reference fields were changed or saved; no vendor assets or private case data are copied into implementation or fixtures.

The design adopts task organization and command hierarchy using CaseVant's own components and supported fields. CaseVant's governed lifecycle stays a separate explicit action. Official reference context: [Case details](https://supportcenter.mycase.com/en/articles/9369884-case-details-page), [Custom fields overview](https://supportcenter.mycase.com/en/articles/9369873-custom-fields-overview).

Source inspection confirms existing WorkspaceDrafts already retains uncontrolled inputs across sections. This refactor improves discoverability and binds editor drafts to their original revision; it does not claim that all previous section switches lost input.

## Implementation review

The visit-owned WorkspaceController retains the editor separately from generic form drafts. The edit-start revision is immutable until the user explicitly discards the draft. Only supported changed fields are sent; no schema, authority, lifecycle, evidence, report or storage contract changes. An uncertain save freezes its submitted fields and offers authorized readback; matching saved details are described as matching, not as proof of who saved them. Confirmed metadata saves leave unrelated drafts intact.

New editor is bilingual, with a prominent header command, focused case-information form, read-only context, textual color statuses, explicit Save & close and guarded Cancel. Case status remains separate; technical controls are collapsed. Applied the React review checklist: event-owned mutations, one workspace authority owner, stable external-store snapshots, no network/persistence added to rendering, labelled native controls, keyboard focus and status semantics.

Initial 34 focused checks pass (22 new editor/controller cases and 12 existing workspace checks). Strict types pass. Scoped lint warning in the synthetic fixture was corrected. Browser checks use real components with an in-memory synthetic server, not production writes.

Browser review found and fixed: return focus attempted while the header command was still disabled during refresh; Russian mobile Save text wrapped to a taller button than Cancel; the surrounding shell's font rule overrode editor command sizing; an old success notice remained when opening a new edit. Corrections wait until refresh ends to return focus, stack mobile commands, increase scoped style specificity and clear obsolete notices at edit entry. Verification and final release evidence follow below.

Product owner additionally requested a maintained `current_progress.md` and retrospective from 29 September to today. Added the chronological summary from canonical integration history and dated release/audit records, with delivered/pending boundaries. AGENTS.md now records the maintenance requirement.

## Local acceptance

- **87 focused tests pass**, zero failures/skips, including 24 new editor cases plus existing workspace rendering, practice, organization and saved-case continuity. A review correction ensures unresolved work recovery takes priority over a merely dirty metadata editor.
- Strict TypeScript and scoped ESLint pass with zero errors/warnings. No dependency changes.
- Real browser at 1280px: open focuses case name; section switching restores name/priority; Cancel focuses Keep editing; explicit discard writes nothing and returns focus; Save closes, updates the case once and returns focus after refresh. A simulated colleague change preserves the exact draft, disables Save and shows latest saved details. Using latest requires explicit discard. Lost-response readback confirms matching saved fields without another PUT.
- Actual 390×640 browser viewport with Russian long text: no horizontal overflow; Tab moves from name to jurisdictions; Cancel/Keep editing/Save work; all editor/header commands measure **44px**, versus **36px** on desktop. Technical details are closed and developer content is absent from visible text. Role downgrade retains visible input, disables the fieldset and Save, and shows a read-only explanation. These are synthetic transport checks, not live permission changes.
- Screenshots are retained in the chat outputs, not added as repository/vendor data. Reference sample was canceled unchanged. Browser override reset and task-created reference/preview tabs closed.

## Release and remaining limits

Not yet released. The broader module roadmap (Library, standalone firm work, CRM, finance, portal and sync) remains separate.
