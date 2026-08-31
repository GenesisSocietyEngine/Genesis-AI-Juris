# v61 Governance, Evidence, and Professional Reports

v61 is one coordinated release containing the v60 governance foundation and the
v61 professional-report product. There is no intermediate public v60 deployment.

## Immutable package contract

Web, Flutter, and Rust recognize the same nine pinned case packages at `1.0.0`:
general advisory, litigation strategy, contract review, tax planning, compliance,
legacy tax/compliance, ERP incident, investigation, and training simulation.
Existing cases are never silently migrated or reinterpreted.

## Governance and evidence

The canonical report model records the exact case type and version, case
fingerprint, evidence-pack version, source citations and legal effective date,
content-safe custody events, controlled decision-table rules, permissions,
redactions, reviewer state, profile, renderer version, and report fingerprint.
Raw prompts are excluded. External/final reports are blocked until the exact case
is workspace-saved, package checks are green, and a named reviewer approves it.

## Professional reports

The immutable data-only report registry covers every output in every playbook.
The primary profiles are an advisory memorandum, litigation strategy and risk
report, contract redline/risk report, tax-position memorandum, compliance
gap/remediation plan, ERP solution design and test pack, investigation findings
chronology, and the training playable scenario with facilitator/debrief companion.

PDFs are generated locally by default. Canonical report-model semantics and
fingerprints are deterministic; PDF bytes are renderer-specific. Generation
creates a content-free local receipt and detects a stale prior report after any
case, profile, or renderer change.

## Release gates

- Exact authorization return to the original Studio and automatic retry of the
  pending save, with an explicit workspace-saved confirmation.
- One-shot stale-JavaScript-chunk recovery and local anonymous PDF generation.
- Strict web typecheck, lint, tests, production build, dependency audit, PDF
  structural/text/render QA, import/export, revision and 18-route parity gates.
- Exact-head Flutter analyze/test and Rust fmt/clippy/test, plus green Android and
  iOS receipts.
- Exact byte parity for both nine-package registry/playbook manifests.
- Mobile v61 merged to `main` before one final public v61 Site deployment.
