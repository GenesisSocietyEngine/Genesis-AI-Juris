# GENESIS: AI Juris — Engineering Roadmap

The product vision and long-term principles live in `VISION.md`. This document tracks the next engineering releases.

## v0.5.0 — Mobile shell

- Flutter application under `apps/juris-mobile`.
- Smartphone-first Inbox, Matter, Calendar, AI, and Career destinations.
- Adaptive Material 3 navigation.
- Immutable UI snapshot contract.
- Deterministic local interaction demo.
- Widget tests and Flutter CI.
- Windows scripts for Android scaffolding, device launch, and debug APK build.

## v0.5.1 — Rust mobile bridge

- Add a stable Rust command/query boundary.
- Convert authoritative engine state into mobile-safe DTOs.
- Submit action IDs from Flutter to Rust.
- Remove gameplay transitions from the demo repository.
- Preserve deterministic seed/replay behavior through FFI.
- Complete the first engine-backed Android playthrough.

## v0.5.2 — Closed playtest APK

- Save and load local sessions.
- Onboarding and scenario start flow.
- Risk confirmations and mandatory-event warnings.
- Judgment and matter-summary screens.
- Replay/seed export.
- Signed internal APK distributed to a small tester group.

## v0.6.0 — Competing matters

- Multiple concurrent matters.
- Firm-level calendar and scheduler.
- Shared player capacity and deadline collisions.
- Delegation queue.
- Partner performance review.
- Persistent relationships across matters.

## v0.7.0 — First career week

- Intake pipeline.
- Billing, realization, and profitability.
- Supervision quality and career feedback.
- Specialization signals.
- End-of-week review and recovery states.

## v0.8.0 — AI actor integration

- Replaceable cloud/local AI adapter.
- Structured prompt policies and audit log.
- Output validation.
- Dynamic client and opponent dialogue.
- Free-form drafting experiments without granting AI state authority.

## Public-alpha threshold

A public alpha should not begin until the project has:

- several coherent matters;
- reliable save/replay support;
- a meaningful career loop;
- jurisdictional legal review;
- explainable outcomes;
- stable automated quality gates;
- privacy and AI-data handling documentation;
- a repeatable signed Android build pipeline.

## v62 — Professional Report Graph Pagination & Document Flow

Status on 2026-09-01: local release candidate gates are green in isolated web and mobile worktrees. The frozen inputs are web `8bd10594bc01e5a45183a743396ac24b7aeaf321`, mobile `29f862649dea378cfe3d4e145f5e396bf6d4c6ff`, and production Site version 63 with marker `v61`. Production remains unchanged and Site version 63 remains the rollback target.

### Product outcome

Produce deterministic A4 portrait professional-report graphs with complete wrapped node text, layer-boundary pagination, no clipped or split nodes, paired BPMN-inspired off-page continuity markers, and a complete extractable textual alternative. This is a document-flow correction only; it must not change case meaning, `ReportModel` content, playable routes, rules, decisions, evidence, or outcomes.

### Architecture and authority

- Keep Rust authoritative for case input validation and runtime semantics.
- Keep `ReportModel` schema 1 and semantic renderer `1.0.0` immutable.
- Insert a presentation-only `ReportGraphLayoutModel` with layout schema 1,
  layout algorithm `1.1.0`, and layout renderer `2.1.0`.
- Bind rendered-report staleness to the layout fingerprint without making the professional matter stale.
- Require identical web and Flutter layout semantics, connector IDs, node-page assignments, and layout fingerprints for locked fixtures; PDF bytes may differ.
- Never treat connector markers, pages, or lanes as case nodes or runtime transitions.

### Current progress

- Report-profile registry parity is established in mobile contracts and Flutter assets without changing the v61 web registry.
- The immutable report manifest covers all nine packages and all 22 playbook outputs exactly once.
- Dart validation fails closed on unknown IDs or versions, duplicates, invalid bindings, and incomplete coverage.
- Focused Flutter parity and malformed-input tests pass, and Flutter analysis passes.
- The immutable Dart layout evaluator now mirrors the finalized web fixed-point algorithm: deterministic components/layers, whole-node A4 portrait pagination, Unicode-safe metric wrapping, same-page anchors, paired `C###` connectors, complete text registers, and canonical layout fingerprints.
- Byte-identical web-generated metrics and fixture assets are bundled and SHA-pinned in Flutter.
- Bhopal, deep, wide/fan-out, fan-in, disconnected, cyclic-repair, long-title/detail EN/RU, and 200-node stress projections match exact web node-page assignments, connector IDs, and layout fingerprints.
- Full Flutter analysis is clean and the complete 258-test mobile suite passes;
  the focused report contract/layout suite passes 15/15.
- Mobile professional-PDF rendering is not yet claimed by this contract work.

### Remaining release gates

- complete web receipt and stale-render integration around the now-implemented layout model;
- A4 geometry, clipping, overflow, adjacency, extraction, and connector-structure checks;
- Poppler rendering and page-by-page visual review, including all legacy bilingual/audience and stress goldens;
- strict web build, typecheck, lint, tests, dependency audit, and all 18 cross-runtime routes;
- Rust format, Clippy with warnings denied, and tests;
- Flutter analyze and full tests plus Android and iOS package/lifecycle gates on one exact head;
- reviewed mobile merge, exact SHA release lock, one saved Site version, explicit pre-deployment approval, production verification, and observability.

Do not create an intermediate public deployment. Do not create an app-store distribution without separate explicit authorization.

### Release-candidate checkpoint - 2026-09-01

- [x] Pass exact web/Flutter report-contract and layout-fixture parity.
- [x] Pass Dart formatting, Flutter analysis, and all 258 Flutter tests.
- [x] Pass Rust formatting, Clippy with warnings denied, and the complete locked
  workspace test matrix.
- [x] Pass all 12 native Android persistence smoke scenarios.
- [ ] Commit and push the exact reviewed mobile head.
- [ ] Bind successful Android, Flutter, iOS, and Rust hosted workflows to that
  exact head in the web release lock.
- [ ] Obtain fresh explicit approval immediately before the sole production Site
  deployment. No app-store distribution is authorized.
