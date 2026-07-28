# GENESIS: AI Juris v0.4.1 — Simulation Integrity Patch

v0.4.1 is based directly on the first complete v0.4 playthrough using seed `20260724`. It does not add a second matter. It hardens the rules that make the existing matter credible, explainable, and strategically meaningful.

## Mandatory events and hearing integrity

- A scheduled hearing now has a two-hour attendance window.
- Rest is unavailable when it would jump over a future hearing.
- Hearing-stage actions are restricted to attendance and any still-live settlement offer.
- Missing the attendance window produces a deterministic default-loss outcome and judicial-credibility penalty.
- Court notices use explicit inbox lifecycle states rather than the ambiguous `open` label.

## Dynamic settlement offers

- Offers now have revision numbers, issue times, and expiry times.
- New evidence and procedural developments can generate revised offers.
- Expert review, opponent-disclosure review, AI damages modelling, and the hearing start can trigger commercial reactions.
- New offers supersede earlier offers.
- Expired offers can no longer be accepted.

## AI deliverables

The scripted AI associate now returns task-specific work product:

- legal-research issue lists;
- evidence contradictions and missing links;
- a quantified damages and settlement range;
- pleading risks;
- hearing questions and weak points.

The engine appends an explicit reliability result so a mechanical bonus or penalty is no longer hidden from the player.

## Workload and budget controls

- Acute fatigue remains recoverable through rest.
- `cumulative_strain` now persists across days and affects quality.
- The client begins with an authorized legal-spend ceiling of EUR 25,000.
- Actions that would exceed the ceiling are withheld until the player requests additional budget approval.
- Each approval raises the ceiling by EUR 25,000 and has a small trust cost.

## Explainability and presentation

- `Base position` is renamed to `Pre-hearing case strength`.
- `Final win threshold` is renamed to `Adjusted win probability`.
- Inbox items now distinguish unread, action-required, resolved, and archived states.
- The CLI displays offer expiry, offer revision, authorized budget, remaining authority, and cumulative strain.

## Test coverage

New tests prove that:

- rest cannot skip a scheduled hearing;
- repeated overtime creates persistent strain;
- client budget authority gates expensive actions;
- resolving one inbox request remains correct even when new messages arrive during the action.
