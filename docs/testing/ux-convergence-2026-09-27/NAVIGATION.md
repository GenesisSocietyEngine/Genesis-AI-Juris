# Stage 1 — shared navigation

## Outcome and acceptance criteria, before implementation

Baseline: local clean source `bf5799383a52b6617cd9d4a0acf47af780086218`, branch `codex/ux-convergence-2026-09-27`; runbook sections 0–7 read. Native baseline and browser measurements belong to the coordinating root's evidence, not this source inspection.

The user should encounter one navigation shell in Studio, My cases, Templates, Account, Organizations and Help. Expandable sections must keep every existing destination and useful Studio/training action while using the established session-aware workspace navigation and departure controls.

Acceptance criteria:

1. Studio and other workspace pages use the same component, labels, route grouping and active-state rules; saved Studio drafts remain distinct from organization cases.
2. Real links retain language, organization and safe return context. Modified clicks/new windows retain browser behavior. Demo, Operations, templates, training, saved drafts and injected utility actions remain reachable.
3. Studio New/Import and simulation Restore/Export actions remain available when supplied. Studio's existing pending-operation guard remains effective; no new auth or authority mechanism is added.
4. Verified identity, organization picker, role-limited Users & access, normal sign-out and retry remain under the existing NavigationController. Dirty/uncertain departure and explicit Stay/Discard semantics remain intact; logout is not trapped by the Studio guard.
5. The established mobile dialog, Escape/focus return and locale controls are retained. Real desktop/narrow/zoom and cross-page visual checks remain NOT_RUN until root performs them; render/handler tests are not browser acceptance.

Scope: `app/GenesisNavigation.tsx`, `app/LegacyGenesisNavigation.tsx` and focused navigation tests only. No JurisApp/CSS edits, persistence/auth/controller changes, builds, source commits or deployment by this agent. Root owns the compact case header and Overview integration.

Initial finding: Studio's `expandable` branch uses a separate component with duplicated destinations, different Account/Organizations behavior and no NavigationSession controls. The other pages already use the robust LegacyGenesisNavigation. The implementation will retain one canonical component and carry the Studio-only optional callbacks into it.

Implementation: both former entry variants now render the existing session-aware LegacyGenesisNavigation. Optional Studio New/Import and Operations controls pass through that component. Its existing mobile dialog, identity/organization controls, departure confirmation and session authority remain in place. The Studio pending-operation callback protects ordinary navigation/actions; sign-out remains available.

Verification: 26/26 targeted render/controller-handler checks passed with pinned Node 22.23.2 (`tests/navigation-shell.test.ts`, `tests/sidebar-navigation.test.ts`, `tests/help-training-navigation.test.ts`, `tests/operations-navigation.test.ts`). Full TypeScript `--noEmit --incremental false` passed, exit 0. Logs: [targeted-final.log](evidence/navigation/targeted-final.log), [typecheck.log](evidence/navigation/typecheck.log). The first sandbox attempt failed in the tsx loader before tests (`uv_os_get_passwd ENOMEM`); the second run found a test expectation that incorrectly scoped the existing public training route. The corrected final check preserves that static route and its new-window behavior.

Independent source review by gate_requirements: PASS, no material finding. Actual desktop/narrow/zoom density, mobile focus/Escape and cross-page visual acceptance remain NOT_RUN by this agent and are assigned to root. No source commit, build or publication was performed here.
