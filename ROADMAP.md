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
