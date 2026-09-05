# First four case types v1

v59 turns the Case Core and multi-view foundation into four usable professional
matter packages:

- advisory decision;
- tax and compliance;
- ERP incident and solution;
- training simulation.

The authoritative product contract is
`contracts/case-type-playbooks.v1.json`. The Flutter asset is byte-identical to
that contract. Every immutable `caseTypeId@1.0.0` defines its intake questions,
AI focus, canonical completeness thresholds, test mode and output profiles.
The registry is allowlisted data only; it contains no executable plug-in code.

## Runtime boundary

All four packages edit and persist the existing canonical
`ScenarioDefinition`. Step 5 always sends that exact document through the Rust
schema validator. Advisory, tax/compliance and ERP packages then run their
declarative completeness checks without manufacturing a playable training
route. Only the training package invokes Rust route execution, and Finish stays
locked until that execution succeeds.

Tax/compliance additionally fails closed until its canonical fact record
contains a legal as-of date, an authoritative HTTPS source and a reporting or
compliance duty. The web projection uses the corresponding structured fields
from the same playbook.

## Product behavior

The six-stage workflow remains stable while the selected package changes:

1. intake questions and AI focus;
2. proposal review;
3. evidence requirements;
4. professional views and actions;
5. validation or simulation mode;
6. primary and supporting outputs.

This keeps one versioned decision package reusable across web and mobile. No
second rules engine, arbitrary JavaScript formula surface or direct AI mutation
path is introduced. Imported package IDs and versions remain validated before
persistence, and Rust remains the authoritative native trust boundary.
