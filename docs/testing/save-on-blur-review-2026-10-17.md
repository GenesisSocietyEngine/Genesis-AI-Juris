# First-click working-draft save review — 17 October 2026

## Baseline and reproduced finding

Production v138, canonical main and isolated checkout matched `ddc939c60d4a33268ea3f61b72171bd63ddb2e7b` before this slice. Both canonical PRs120/121 and main39021986664 passed web/PDF gates. Native deployment `appgdep_6ad3449df6848191a75a55f5e00a6989` succeeded at09:49:43UTC, env42; native/public assets161/161 passed. This is a completed interim release, not the final acceptance of first-click saving.

Fresh authenticated Chrome opened a new Canopy copy, changed its title, waited for the enabled Save control and clicked once. That click did not save: no receipt, no custom_case URL, no success. A second settled click saved the exact synthetic copy as case30. Preserve case30 and all prior cases. No real user case was modified.

The title/jurisdiction/role/context controls call commitCaseField on blur. It appends visual history and updatedAt through checkpointStudioDraft, replacing the draft object. This invalidates StudioDerivations; Save was disabled between pointer focus/blur and click. Its handler also refused unsettled derivations. This proves one fresh first-click failure path; it does not explain every historical missed interaction.

## Product contract and amendment

Explicit Save stores the exact current working draft, including blur-committed history. It is independent of model analysis readiness. The existing POST handler validates the complete aggregate and fingerprints for every save; structural findings block submit, not ordinary working-draft saves. No automatic queue or retry is introduced.

Keep save buttons enabled while model checks run, across the header, guide, review actions and developer persistence panel. Restore/actor readiness, read-only permission and one in-flight operation still block. The handler directly checks the frozen payload's900KB limit before tax preparation or a request. Submit/report/AI analysis retain current-check requirements. A failed model check is visibly separate from durable save status; manual analysis retry remains available.

After an exact verified receipt, retain the same immutable saved input/protection object as a fast status reference. Show confirmed persistence while analysis of that identical input is pending; any new input object loses that fast confirmation. Settled fingerprint comparison keeps existing semantic dirty/revert behavior. Changed visibility and missing receipts cannot produce success. Never use matching source ID/name as proof of a save.

Tax preparation, complete carriers, same-origin/server authorization, restore/account/version guards, database CAS, source history, report authority and template versions are unchanged. No schema, case factory, report renderer or approval change.

## Acceptance

- Real extracted handler saves an exact blur-history/tax payload with derivations pending; submit with the same pending state makes no request.
- Restore/pending-operation guards make zero preparation/writes; duplicates coalesce. Oversized frozen input is refused before tax/request even while derivations are stale.
- Receipt status survives pending analysis only for the identical saved input or a settled matching fingerprint; later edits, same-ID clones without checking, changed privacy and absent receipts do not confirm.
- Browser: keep the field focused through edit → one click on Save; verify new saved ID, actual history/title/context on independent reopen. Repeat EN/RU and narrow flow, plus actual report download. Keep browser and extracted-handler evidence distinct.
- Full canonical web/PDF gates, exact merged build, actual v138 predecessor asset retention, native/public receipts and live changed flow before final completion. v138 archive must be retained as the actual predecessor; the unpublished32739fa build is not a predecessor.

## Verification checkpoints

25 targeted tests pass. The first handwritten history fixture was rejected by the exact-payload assertion because it omitted required history metadata; the corrected regression uses the real appendStudioHistory authoring helper and verifies the complete payload, rather than weakening normalization. Compiler/lint, local browser and final canonical/live receipts follow separately.


Pre-publication receipt review: the inherited workspace dirty comparison used studioAIBaseFingerprint. Its redacted context omits retained tax content and premisePublication; it is not an authoritative persistence proof. Bind initial saved state to serverPublicationFingerprint, checked current state to casePublicationFingerprint calculated in the existing idle derivation, and confirmed state to the exact returned publication receipt. Keep AI fingerprints for AI only. A regression changes exact tax-document bytes and context-review state with the same timestamp/AI context and must invalidate Saved in both cases. No case/server fingerprint algorithm or historical receipt bytes change. The exact-input fast path still confirms only the immutable input adopted after a verified receipt.
