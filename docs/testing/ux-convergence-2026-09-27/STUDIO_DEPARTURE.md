# Studio unsaved departure correction

Before implementation: the coordinating browser found that an anonymous Canopy working copy could leave through My cases and return blank, without a warning. Studio's existing `mayLeaveStudio` checks only an active operation; anonymous drafts are intentionally not stored on the device.

Outcome and criteria:

1. A meaningful unsaved Studio draft or prompt registers dirty risk with the existing NavigationController, so ordinary links and supported history navigation offer Stay/Discard and full-page unload warns. No new guest storage or auth mechanism.
2. Blank work is clear; exact verified workspace save/open and successful eligible device save/restore establish only a memory baseline. Version/history/prompt and changed content remain protected; server fingerprint checks remain authoritative. A failed save, stale receipt, or pending operation cannot mark work clean.
3. Stay preserves the same draft object/content. Explicit discard uses the existing departure plan. Logout remains available, and a successful existing sign-in continuation suppresses only its intentional departure warning after storage succeeds; storage failure keeps the warning.
4. StudioSessionAuthority still owns private concealment/discard. No changes to credentials, permissions, receipt verification, persistence eligibility, pending-operation semantics or APIs.
5. Targeted tests use actual Canopy, guard/controller, existing history and real extracted parent/auth handlers. Browser reproduction and confirmation remain root-owned; local tests alone do not prove native dialog behavior.

Scope approved by root: parent JurisApp guard registration and memory baseline, narrowly necessary verified-save/auth callbacks, helper and focused tests; one truthful paragraph in the existing shared departure dialog. No broad navigation rewrite.

## Implementation and evidence

Parent JurisApp now registers a live risk getter through the existing NavigationController. No new departure dialog or history/unload implementation was added. The baseline is memory-only and is established after verified workspace open/save or successful eligible account-scoped device save/restore. The full authoring comparison retains version, history and copy policy while ignoring update timestamps and server-generated seal/code fields; exact server content/publication fingerprints are still checked for workspace cases. The prompt buffer remains protected because ordinary workspace/device saves do not store it. New-local and purge paths clear the baseline.

The existing `mayLeaveStudio` pending-operation check is retained. Dirty state reaches the existing Stay/Discard dialog instead of blocking its explicit Discard action. Sign-out still bypasses departure risks. The explicit Studio sign-in flow approves departure only after its existing eligible temporary continuation is written; exceptions cancel approval and retain the warning. No additional guest content is persisted, and StudioSessionAuthority still owns private concealment and discard.

Verification:

- 23/23 PASS with pinned Node 22.23.2: `--import tsx --test tests/studio-departure.test.ts tests/navigation-shell.test.ts tests/onboarding-continuation.test.ts tests/studio-save-receipt.test.ts`; [log](evidence/studio-departure/targeted-1.log).
- New tests execute the actual extracted parent registration, baseline and auth handlers with real Canopy input and existing NavigationController/history implementation. They cover anonymous/prompt work, exact saved state versus unsaved version/history, stale/account mismatch, device eligibility, pending precedence, logout, Stay/history preservation and successful/failed auth continuation.
- TypeScript `--noEmit --incremental false` passed, exit 0; [log](evidence/studio-departure/typecheck.log). `git diff --check` passed.
- Root subsequently reported an actual local Chrome check: ordinary Open My cases opened the existing Leave unsaved changes dialog; Stay retained the same URL and Canopy's 14 nodes / 13 links. This observation is attributed to root, not performed by this agent. Cross-document Back/reload, explicit Discard and actual saved-work navigation require their own browser observations; the tests do not claim them.

Independent read-only review by gate_requirements: PASS, no remaining material finding. A proposed privacy-baseline concern was reconciled against the actual UI: changing visibility on a saved case performs its own authenticated mutation and updates local privacy only after the exact response is confirmed. It therefore does not represent an unsaved content edit. The local unsaved branch remains protected by the missing baseline/device eligibility. No speculative privacy patch was added.

Product files are frozen for root's parallel graph integration. No build, source commit, publication, new storage mechanism or hosted data change was performed by this agent.
