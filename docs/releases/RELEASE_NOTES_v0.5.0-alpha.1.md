# GENESIS: AI Juris v0.5.0-alpha.1

## Milestone

First stable mobile legal-case vertical slice.

## Included

- Android Flutter application shell.
- Inbox, Matter, Calendar, AI Associate, and Career navigation.
- Deterministic Failed ERP Implementation case flow.
- Evidence-preservation and partner-risk deadlines.
- Independent ERP expert lifecycle.
- Settlement acceptance and rejection.
- Pleadings, evidence, hearing preparation, and hearing workflow.
- Formal hearing scheduling and rescheduling.
- Explainable judgment outcomes.
- Winning, mixed, and losing judgment branches.
- Client-notification workflow.
- Optional counterparty cassation branch.
- Claimant review-options workflow after dismissal.
- Inbox read and resolution lifecycle.
- Automated Flutter regression tests.

## Known architectural limitation

The mobile application still uses DemoGameRepository. The Rust simulation
engine is not yet connected to Flutter and does not yet load declarative
scenario definitions.

## Next milestone

v0.5.1:

- ScenarioDefinition v1;
- scenario validator;
- Failed ERP Implementation YAML scenario;
- Rust mobile API boundary;
- preparation for Flutter–Rust integration.