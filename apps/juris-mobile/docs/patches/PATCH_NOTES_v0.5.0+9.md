# GENESIS: AI Juris v0.5.0+9

## Adverse judgment branch

This cumulative patch replaces v0.5.0+8 and adds a genuine losing outcome that does not depend on missing the court hearing.

### Judgment model

The deterministic demo judgment now has three bands:

- `Judgment: claim substantially upheld`
- `Judgment: mixed outcome`
- `Judgment: claim dismissed`

The judgment score combines:

- case strength;
- merits;
- evidence;
- procedure;
- completed optional hearing preparation;
- a bounded deterministic court variance derived from the scenario seed.

Attending the hearing is therefore necessary but not sufficient. A weak causation and quantum record can still lose on the merits.

The same seed and action sequence always produces the same result. The standard demo seed `20260724` preserves the substantially-upheld branch. Seed `20260701` exercises the new attended-hearing loss branch in regression tests.

### Explainability

Dismissed and mixed judgments include the contributing merits, evidence, procedure, preparation, and deterministic court-variance values in the judgment message.

### Post-loss workflow

After the player informs the client of a dismissed claim:

1. the client requests an assessment of post-judgment challenge options;
2. `Assess claimant review options` becomes action-required work;
3. the player delivers a cost, scope, timing, and prospects assessment;
4. the client may accept the recommendation and close the matter in this simplified demo branch.

This workflow distinguishes legal-review grounds from disagreement with factual findings.

## Regression coverage

Added tests proving that:

- a hearing can be attended and completed while the claim is nevertheless dismissed;
- the dismissal is not caused by a missed-hearing event;
- the losing judgment creates a claimant review-options workflow;
- completing the review advice resolves the required message and closes the matter deterministically.
