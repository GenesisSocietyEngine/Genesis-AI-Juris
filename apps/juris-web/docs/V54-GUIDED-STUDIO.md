# v54 Guided Studio — product and architecture specification

Status: web and native mobile implementation complete; every exact-SHA v54 gate is verified.

## Current journey and friction

The v53 Studio exposes the complete authoring surface on one long page. It is powerful, but a first-time user must simultaneously understand prompts, AI review, metadata, access controls, graph terminology, runtime rules, compiler checks, testing, reports, and submission. The existing four-item guide is informational rather than navigational: it does not isolate a current task, preserve a workflow position, or provide explicit Back and Continue behavior.

The native Flutter application at mobile SHA `4f4af89dc5e9d2195cda1022669d163adfffd8ae` adds the shared six-stage workflow, canonical `ScenarioDefinition` editing, device recovery, JSON import/export, and a fail-closed Rust validation and execution gate. The Flutter UI does not approve or simulate its own graph: Rust parses the exact canonical document and executes its route before Finish unlocks.

## Shared workflow contract

Web and mobile must use these stable IDs and this order:

| Step | Stable ID | User goal | Completion signal |
|---:|---|---|---|
| 1 | `describe` | Start from a short brief, example, or import | Reviewable proposal or existing draft is available |
| 2 | `review_ai_draft` | Review assumptions, warnings, and operations | Structured proposal is explicitly applied |
| 3 | `facts_assumptions` | Confirm title, jurisdiction, role, context, and economics | Required facts are present |
| 4 | `case_map` | Review nodes, choices, and terminal outcomes | Nodes and connections form an editable map |
| 5 | `run_compare` | Resolve checks and run the authored case | Canonical compiler returns a playable scenario |
| 6 | `report_save` | Save, export, or submit | User completes the selected output action |

The executable web transition model is in `app/studio-workflow.ts`. `invalidate_from` removes completion for the changed stage and every downstream stage. Guided and Expert modes continue to edit the same `StudioDraft`; there is no guided-only case format.

## Responsive wireframe

The guided shell has four stable regions:

1. Case header: case name, workspace save state, and validation state.
2. Six-stage stepper: completed, current, and incomplete states with semantic buttons.
3. Current-task card: one short explanation, readiness message, and Back/Continue controls.
4. Stage workspace: only the capabilities relevant to the active stage; Expert mode restores the complete surface.

Desktop uses a six-column stepper and three-column final-action panel. Tablet uses a 3×2 stepper. Narrow layouts use a 2×3 stepper, a single-column task card, full-width navigation controls, and single-column final actions. All starting-choice cards and navigation actions meet the existing touch-target system.

## State and recovery

- The active stage is serialized by stable ID in the `studio_step` URL parameter.
- Back/forward navigation restores the stage through `popstate`.
- Refresh and return visits restore the last stage from a case-scoped local-storage key.
- Device storage contains the stage ID only; no prompt, case, client, or legal content is written by the workflow shell.
- Workspace draft persistence, import/export, revision protection, and canonical compilation remain owned by the existing Studio implementation.

## Mobile parity release boundary

The web shell must not be deployed as v54 until Flutter's six-stage authoring, persistence, validation, recovery, testing, and export pass their hosted gates. Native v0.7.0+14 reuses authoritative Rust validation and runtime execution through the expanded mobile bridge and does not create a second Dart rules engine. The exact mobile source tree is `9b5545e7d211ac0b5e4c55a50a2eb4de0ebc8edd`, published at gate commit `4f4af89dc5e9d2195cda1022669d163adfffd8ae`.

The locked Rust, Flutter, Android, and iOS workflow receipts are green for the exact mobile commit, and the web release gate confirms the deterministic 18-route matrix before production activation.

## Baseline gate correction found during v54

The committed v53 fixture bytes hash to `a2bfc44aea172350a7f307990929d017c8f953765d2f02b93d580f5fb6137bd7`, while the v53 lock recorded a non-committed working-copy hash. The 18 route IDs, 290 checkpoints, 45 judicial checkpoints, every locked route projection, the mobile probe, and the canonical bundle remain unchanged. v54 corrects only the fixture-byte receipt so a clean checkout can execute the existing parity gate.
