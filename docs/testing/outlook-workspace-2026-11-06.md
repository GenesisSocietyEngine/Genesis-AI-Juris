# Outlook workspace refactor — 6 November 2026

## Baseline and acceptance

Canonical main is `5bc07f8d86f2f091580033ead4a9b1d6b6327b45`. The Sites source-opening helper returned live v187 runtime `77d8b04e2d41b0f944a06259de2af634a7137ebc`; canonical main adds release documentation only. Original local checkpoints are older and untouched. This isolated clean checkout owns branch `codex/outlook-workspace-20261106`.

The existing programme has delivered task triage, month calendar, participant directory, applied workflow retrieval, next-work case summaries and named decision-map linking. Important gaps remain: standalone CRM, document library/templates/intake, client portal, external delivery/calendar synchronization, billing and finance. This refactor advances the operational UI, not those service capabilities.

Fresh read-only MyCase inspection: Home quick actions and compact dashboard; Calendar month/day navigation, sidebar calendar and type/staff filters; Cases filter bar, stage, next event/task, status update and list actions. No MyCase record was changed. Reference restored to its dashboard. Reuse interaction concepts and original CaseVant icons, not vendor artwork.

Intended outcome: recognizable Outlook-style commands, uniform control sizing, understandable text-plus-color statuses, graphical calendar categories and reading panes. Hide routine technical IDs behind disclosure; retain exact values for identity and use disambiguation only for duplicate names.

Acceptance: same-size commands (36px desktop/44px narrow), keyboard focus, EN/RU long labels, no 390px horizontal overflow, month keyboard/date navigation and agenda selection, filter reset/selection continuity, truthful overdue/completed/event labels, preserved template drafts/recovery and controller access gates. No persistence or permission/schema changes. Record all verification and limitations below before publication.

## Implemented slice

- `/` without a legacy continuation now opens `/work?view=home`; language and organization survive. Explicit Studio URLs and existing continuation parameters remain supported.
- Home uses the existing authorized case loader for real case/work counts, today's work, overdue tasks, upcoming events and case summaries. Metrics open filtered work views. New case, task, event and document actions reach existing case flows; nothing is saved just by navigating.
- Primary navigation is Home, Calendar, Tasks, Cases, People and Workflows. AI Case Studio, saved drafts, demos, templates and simulations remain in Tools & library with their departure guards and Studio action portal.
- Shared command sizes, original icons and semantic text-plus-color status badges now connect the Home, Calendar, task reading pane and case work surfaces. Technical IDs move to closed details. Identically named options retain exact identity disambiguation.
- Dashboard derivation, status presentation and the reading pane are separate modules. Calendar CSS is consolidated; existing controller, persistence, permissions, save recovery and reporting contracts are preserved.
- Review corrected multi-day event Today filtering, excluded past events from overdue-task counts, added a real dashboard load-failure state, retained explicit write-authority checks on quick entry and removed revision/backend prose from new-case creation. No dependency, migration, PDF lock or provider changes.

## Candidate evidence

- Strict TypeScript check and scoped ESLint pass. Focused existing/new suite: 42 passes, zero failures/skips. Four new tests cover dashboard derivation, immutable inputs, ongoing events, truthful states and duplicate-label identity.
- Real components with isolated synthetic adapters: desktop Home and Calendar inspected; Home summary opens overdue Tasks with the correct filter/count; reading pane receives focus with IDs collapsed; case chooser preserves exact case/context and Escape restores trigger focus; month ArrowRight/Enter opens the corresponding day agenda.
- Actual Home 390 × 640 EN/RU: document width 375 within 390 CSS pixels; command heights 44px; labels wrap. Desktop uses 36px commands. Later viewport targeting after opening a second fixture tab was inconsistent and then timed out; do not claim a separate 390px Calendar pass from that attempt.
- Integrated case fixture: task shortcut opens an unsaved Task editor with Title focused and consumes its URL action; editing text survives Tasks → Calendar; cancellation removes only the synthetic draft. New-case shortcut opens the ordinary creation form with simplified labels, without a write.
- A template draft survives Workflow templates → Home → Workflow templates with its exact title. Synthetic draft discarded after verification. This supplements existing controller/recovery tests, not a production write claim.
- MyCase remained read-only. Other user worktrees, records and tabs were not modified. Browser component evidence is distinct from authenticated production acceptance.
- First local build reached compilation but correctly rejected a changing source tree while the final new-case wording was being edited. That output is discarded. Release requires a stable exact-head build and full canonical web/PDF CI below.

## Release status

Candidate only at this checkpoint. Full CI, ordinary integration, exact-main provenance, previous-live asset retention and live acceptance are pending. No claim of complete MyCase parity: CRM, finance, external delivery/sync, standalone work, Library and client portal remain separate work.

### Final review corrections

Undated events now show Open, with a regression assertion, rather than suggesting an absent schedule. Shared command sizing also covers case creation, case commands and section buttons; actual desktop New case/Create case/Refresh/Add task measured 36px, narrow controls 44px. The source-stable local build passed before this final presentation-only correction.

A fresh active synthetic tab resolved viewport targeting: Russian month calendar at actual 390 × 640 has document width 375, readable wrapping, visible focused day and working ArrowRight navigation. EN/RU Home and narrow calendar evidence are now distinct successful captures. Temporary viewport reset succeeded before closing this browser verification part. Earlier failed attempts remain recorded above as troubleshooting history.

### CI contract correction

The first complete candidate CI build passed compilation, type checks, lint, lock checks and PDF visuals. Its full suite exposed two stale presentation expectations (old server-oriented creation copy and a navigation link assumed to contain only text). Replaced them with assertions for plain-language creation, server-owned identity, the unique selected navigation link and its exact destination. The two affected suites now pass all 17 tests; scoped ESLint passes. Application code is unchanged by this correction.

The stable local production build passed. Targeted Git migration and local D1 diagnostics also pass outside the restricted executor. Interrupted broad local runs are not acceptance evidence; the complete canonical CI run remains the release gate.
