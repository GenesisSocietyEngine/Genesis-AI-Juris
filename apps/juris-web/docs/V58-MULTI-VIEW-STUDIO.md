# v58 Multi-view Studio

## Product outcome

v58 turns the versioned Case Core into a working professional surface. A user
can inspect one matter through the views declared by its pinned case-type
package without creating separate copies of the case:

- advisory: issue map, evidence map, decision table and timeline;
- tax/compliance: issue map, decision table, economics and timeline;
- ERP incident: task/process plan, evidence map, decision table and timeline;
- training: simulation, timeline and evidence map.

The product objective remains: turn an unstructured professional matter into a
versioned, explainable, testable and reusable decision package.

## Architecture

`StudioDraft` remains the only editable web source. `projectCaseView` is a pure,
read-only projection over its nodes, relations and existing economics model.
Selecting a view never changes the draft, its fingerprint, edit history,
lineage, compiler output or publication state.

Case packages continue to be immutable allowlisted data. The existing v1
registry already declares the permitted view IDs, so v58 activates that
contract without adding executable package code or changing registry bytes.

## Web experience

Step 4 now opens a case-type-driven view switcher before the visual graph:

- issue cards show supporting record items and linked outcomes;
- evidence cards expose unlinked facts, evidence or authorities;
- the decision table shows availability, consequence, time and cost;
- the ERP process view sequences work and deadlines;
- the timeline retains unscheduled objects instead of hiding them;
- tax economics reuses the existing controlled calculation model;
- simulation summarizes decisions and terminal outcomes before the existing
  playable compiler gate.

Every projected item can focus its source object in the existing graph.

## Mobile parity

Flutter reads the same view list from the byte-locked case-type registry and
projects the canonical `ScenarioDefinition`; it does not persist a mobile-only
view model. The projection is read-only and cannot validate or approve a case.
Step 5 still sends the exact scenario to Rust and executes the validated route
before Finish is available.

The release remains fail-closed until the exact mobile commit has green Rust,
Flutter, Android and iOS receipts and the unchanged 18-route cross-runtime gate
passes.

## Release evidence

- exact mobile source: `1e2160de77b2406b812fa387a53bf81cfce2ad1d`;
- Rust: workflow `33391461350`;
- Flutter: workflow `33391461393`;
- Android native FFI: workflow `33391461423`;
- iOS native FFI and simulator lifecycle: workflow `33391461345`;
- mobile merge: PR #35, merge commit
  `8b5253577796d5855847ce865531d65a2b859181`;
- web: 226 tests, strict TypeScript, lint and zero production dependency
  vulnerabilities;
- parity: unchanged byte-locked registry and canonical bundle, 18 routes and
  290 checkpoints.

## UX correction included

Developer view now has a bounded headline column and a responsive multi-column
action grid. Activating it no longer lets the toolbar's intrinsic width squeeze
the Studio title into a narrow vertical stack.
