# Separate read-only finalization after recorded stops

28 September 2026 UTC. Authored source review; the finalizer and paired assembler have not been executed by this reviewer. Independent source review has been requested before coordinator execution.

Receipt #1 remains `STOPPED_FOR_REVIEW`: ADB exit0 contained a console rejection, followed by the timestamp-precision guard refusal. Receipt #2 also remains `STOPPED_FOR_REVIEW`, but it records both exact guarded fallback stop actions at `01:04:43.7786303Z` and `01:04:44.0767662Z`, followed by immediate `Executable identity mismatch: 25048`. Receipt #2 SHA is `b1a780e7f56f81579f386f6bcfe1f42efddb969d23236d7e75179abefbe66c25`. The error is consistent with an exiting process returning incomplete CIM metadata, but this cause is an inference; the receipt itself does not establish the precise transient. The coordinator separately observed both IDs absent and empty ADB devices at `01:05:15.1998412Z` (reported tool chunk `682556`). No new stop or emulator launch is needed or proposed.

The existing archived failed receipts remain at the eventual document-relative links `evidence/amendment-final/native-cleanup/first-execution-stopped.json` and `evidence/amendment-final/native-cleanup/second-execution-stopped.json`. Neither is rewritten or relabeled.

`finalize-owned-cleanup-readonly.ps1` pins the exact second receipt and requires its recorded action history. It copies the existing preservation helper unchanged and performs only fresh reads of PIDs4116/25048, `adb devices`, original AVD config/hash/full relative-path-size-mtime metadata, and exact clean mobile source. Presence of either PID, the serial, or a preservation mismatch refuses finalization. It does not contain Stop-Process, Kill, emulator start, token read or access mutation. Its only write is a new ignored receipt. PowerShell parser-only validation passed (chunk `776001`); this is not a runtime pass.

The new receipt has schema `genesis.juris.owned-emulator-finalization.v1`, mode `READ_ONLY_FINALIZATION`, `executedStop:false`, a hash-bound pointer to the unchanged failed immediate-postcheck receipt, fresh observation timestamps and preservation results. Only actual successful reads permit `PRIOR_OWNED_STOPS_AND_CURRENT_PRESERVATION_CONFIRMED`.

`assemble-final-status-cleanup-finalized.mjs` retains the prior source and introduces a specific composite-proof path. It accepts only this distinct finalization schema and the pinned second receipt/error/action set, checks time order and exact fresh absence, then subjects the prior actions and final preservation to the existing complete native/CIM/ownership/aggregate guards. A temporary validation object joins the earlier execution and later read scope; it is never written as a replacement execution receipt. The output copies the raw finalization input unchanged and records the method in the assembly manifest. All three reports link both failed attempts and expressly describe separate later read-only proof; they do not claim the immediate postcheck succeeded.

Prepared source identities:

- Finalizer SHA `65642c87de97b8ff1e1bd15fc35070db7ad4c60c8e18d1f59adbc616923837ff`.
- Separate assembler SHA `02a9159dd2c7693d25f12575bbcd742cd4dd9471bd844ba48197fb1c91ca6779`.

Original cleanup scripts, both unsuccessful receipts, previous assembler versions and archived independent reviews remain unchanged. This is cleanup-evidence reconciliation, not an application/test change or a new release gate. The coordinator must inspect actual finalization and actual assembled outputs before publishing status. A failed finalizer remains a failure and must not trigger another stop attempt through this code.
