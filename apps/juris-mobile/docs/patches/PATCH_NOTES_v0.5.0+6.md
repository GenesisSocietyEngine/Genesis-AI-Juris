# GENESIS: AI Juris mobile — v0.5.0+6 stage progression patch

## Problem fixed

The demo clock could continue to Day 8 and beyond while the matter remained permanently in `Pre-litigation`. The previous mobile repository only implemented these stage transitions:

- Intake -> Investigation
- Investigation -> Pre-litigation
- Settlement accepted -> Resolved

It had no command that moved a rejected or expired settlement matter into formal proceedings.

## New stage lifecycle

The mobile vertical slice now supports:

1. Pre-litigation
2. Pleadings
3. Evidence
4. Hearing preparation
5. Judgment pending
6. Resolved

## New actions

- `Commence proceedings`
- `Prepare and file statement of claim`
- `Prepare and file evidence bundle`
- `Attend enterprise court hearing`

After the hearing, resting until the next workday produces an explainable deterministic judgment and resolves the matter.

## Settlement lifecycle

- Rejecting the settlement offer immediately unlocks `Commence proceedings`.
- An unanswered offer expires according to its `expiresAt` timestamp.
- Expiry resolves the old offer message, removes stale accept/reject actions, adds an expiry notification, and unlocks formal proceedings.

## Regression coverage

Added tests proving that:

- rejecting settlement exposes the formal-proceedings action;
- an expired offer also exposes the action;
- the matter can progress through pleadings, evidence, hearing, judgment, and resolution.

## Authority note

This remains a deterministic Flutter demo repository. The Rust engine should become authoritative when the Flutter-Rust bridge is introduced.
