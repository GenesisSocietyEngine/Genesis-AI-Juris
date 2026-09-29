# UX convergence baseline — 27 September 2026

The user explicitly requested staged implementation of the 27 September runbook after clarification. Source audit 26 September is a guest-session heuristic audit; its unperformed authenticated, download and accessibility checks are not reproduced failures.

Production: `https://studio.falcon-merlin.com`, project `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`, v102, source `bf5799383a52b6617cd9d4a0acf47af780086218`. Native deployment `appgdep_6ab6ed70ee488191ba95f30293b6e6a1` succeeded; environment revision 39, updated 2026-09-25T21:55:07.113680Z. Native version `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_37dbecce77848191a3dc4397ee48dc73`.

Configured production source branch main was fetched through the Sites Git credential and resolves exactly to that SHA. No push or deployment was performed. Credential publication-on-push was false, with no current window reported. Work proceeds in isolated branch `codex/ux-convergence-2026-09-27`, worktree `.worktrees/ux-convergence-2026-09-27`. The root checkout's unrelated modifications and all earlier evidence remain untouched.

Changes already in v100–102: organization display labels/member-ID guidance and Base/Medium/Full PDF/tree choices. Preserve these rather than reimplementing v99. Schema and authentication contracts are unchanged by the initial UX work. Local Vite preview uses isolated project-local storage, never the hosted database; local guest checks do not prove hosted authentication/persistence.

Baseline live Chrome: entry → Open demo case → View walkthrough → Canopy selection/editor. Studio uses expandable navigation while Account/Organizations use the other navigation implementation. Canopy canonical fixture contains nine source document IDs across immutable versions, but only one typed evidence node and no typed fact nodes. These quantities are not interchangeable.

Stage 1–2 target: one guarded navigation component; one-action Base Canopy working-copy entry; compact case header and Overview with truthful recommendation status, existing source material and concrete next action. Preserve existing workflow URLs, training routes, all data, input protections, output authority and reports.

Acceptance before changes: home-to-Overview within two intentional actions; no manufactured selected outcome/approval; laptop 1366×768 useful case content visible; Back/Forward restores chosen panel; old studio_step routes remain; guest save explains sign-in/storage; source/settings separation does not alter the draft. Independent review and targeted regression required before claiming the stage PASS.
