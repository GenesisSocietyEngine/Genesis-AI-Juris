# Expanded decision map: component review

Date: 2026-09-27. Intended outcome: open the entire recorded map in a larger view, then select a readable node title and return to the existing case detail without editing, re-layout, choosing an outcome or approving anything.

## Scope

New `app/StudioExpandedGraph.tsx` and `app/studio-expanded-graph.module.css` only. Parent integration belongs to the main agent. Inputs are the existing projected `StudioNode[]`, recorded `StudioLink[]`, locale, and close/node callbacks. The component never calls the layout engine or writes model data.

- SVG uses the supplied coordinates; the viewBox encloses the nodes, including negative positions. Every drawable relation retains its original ID and order. Missing endpoints and invalid coordinates produce explicit notices rather than substitute nodes or relations.
- Native `dialog.showModal()` supplies modal interaction. Escape requests closure; cleanup closes the native dialog and restores its previous connected focus. Selecting a node invokes close before the existing parent detail callback.
- SVG nodes support Enter/Space, carry the full title in their accessible label/title, and have visible focus treatment. A normal select exposes all recorded node titles at readable size when a tall map's fitted labels become small.
- No API, persistent state, authorization rule, upload, PDF renderer, migration or configuration change. Colors follow existing app theme variables. No graph edits are exposed in the expanded view.

## Verification

Pinned Node 22.23.2:

- **4/4 targeted tests PASS**, zero skipped: [TAP](evidence/studio-expanded-graph-tests.log).
- **Full TypeScript PASS**, `tsc --noEmit --incremental false`: [output](evidence/studio-expanded-graph-typecheck.log).
- **Focused ESLint PASS**, no findings: [output](evidence/studio-expanded-graph-lint.log).
- Independent bounded read-only component/CSS review by `gate_requirements`: **PASS**, no material finding. Reviewer did not run tests or browser actions.

Tests bundle the real component with CSS-name stubs and explicit React effect/ref adapters. They exercise preservation of input bytes, node coordinates and link order; exact close-before-node callbacks; Enter/Space and non-action keys; native open/cleanup calls and focus-return intent; missing endpoints and unavailable-coordinate handling. This is a component contract test, not proof of the browser's focus trap, final visual layout or parent integration.

## Parent acceptance still required

The existing inspector must receive focus after native dialog cleanup. The parent must close/unmount the top-layer native dialog on Studio authority suspension, revocation or scope replacement; an inert/hidden ancestor alone is not a sufficient security argument. Legitimate inspection-only access must remain separate from editing/export permission. Real browser opening, Escape, Tab behavior, exact node jump, responsive geometry and authority-loss behavior must be checked after integration. No hosted or final-release acceptance is claimed here.
