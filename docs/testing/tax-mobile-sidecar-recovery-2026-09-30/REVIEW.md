# Tax sidecar preservation and conditional saves

This bounded development slice starts from PR #69 candidate `2eac66e109d95b14ca303eb6c21de63f3e7538a8`, including canonical checkpoint documentation at `99805a9f7b36d53dffd5aaee282a011efa9e30d1`. It is developed separately from that candidate's running CI. The implementation and local results below initially describe uncommitted source on that base; accepted main and final-head evidence must be reconciled before merge.

## User outcome and acceptance

A supported analysis must retain incomplete edits, original imports and unknown nested content while storage recovers only a validated committed generation. A stale editor must not replace another editor's saved generation. Opaque or unresolved work must stay preserved and read-only, with an explicit recovery path rather than a blank editable fallback.

Acceptance for this slice is deterministic real-filesystem recovery/concurrency tests, production-widget conflict/recovery tests, unchanged existing navigation/confirmation/import behavior, and the existing real-Rust editor lifecycle tests. These checks do not substitute for controlled process termination in an Android/iOS application.

## Original defects and correction

The original sidecar serialized only within one store instance, validated the mutable caller after awaiting its directory, promoted a missing-primary backup before validating it, and replaced orphan temporary bytes. An ignored characterization on exact source `829ccc5b8e39812a83bffdc3cf8d0dd9a8b60140` retained one passing control and eight failing desired-preservation assertions. Separately, an actual Android stop before Save completion left an older primary/backup beside a complete new temporary payload. That observation was an uncontrolled early stop, not a failure of an acknowledged completed Save.

The new shared coordinator reserves directory resolution in invocation order, resolves application-support root aliases, and serializes workspace and sidecar reads/writes at that root. Different resolved roots can proceed independently once reserved. Domain parsing stays in the stores. This is static coordination within one Dart isolate; it is neither a cross-process lock nor a two-file transaction.

The sidecar validates the same encoded, detached artifact that it later writes, before any provider/queue wait. `validTaxArtifact` checks whether the known editor can safely use the shape; storage does not normalize it, drop unknown fields, recompute tax values, rebind source identities, or reconstruct imported originals. Existing `read`, `write` and two-space JSON export signatures remain available. Compatibility `write` retains explicit replacement semantics; production read/edit/write callers now use the additive conditional API.

`readSnapshot` returns an immutable exact-byte digest/absence token tied to the case and resolved target, with a detached artifact getter and any read-only restriction. `writeIfUnchanged` checks the current generation under the same root lease and returns a new token only after success. Artifact revision alone is not a concurrency token. Export freezes its payload before awaiting and uses a new filename without replacing an earlier export.

| Disk state | Behavior |
| --- | --- |
| Supported committed primary | Authoritative; unresolved auxiliary bytes do not become a newer committed result. |
| Identity-matching opaque primary, including future protocol/schema or uneditable known shape | Returned intact and read-only; never downgraded to an older backup. |
| Missing, malformed UTF-8/JSON, or wrong-case primary plus supported same-case backup | Validate backup first, quarantine any corrupt/wrong-case primary under a unique name, copy/verify exact backup bytes, and keep the backup. Wrong-case originals are never silently deleted. |
| Missing primary plus supported backup and complete supported temporary payload | Restore the committed backup; retain the temporary payload as uncommitted work. A subsequent write preserves it under a unique interrupted-work name. |
| Only temporary work, or no valid authoritative/backup generation | Refuse editable load/write and retain every original byte. |
| Opaque/future or wrong-case backup/temporary beside a valid primary | Allow inspection/export of the primary with a read-only restriction; block writes without changing any generation. |
| Corrupt backup or supported/corrupt orphan temporary beside a valid primary | Before a new write, preserve auxiliary bytes under unique recovery names, then rotate the last committed primary into backup. |
| Non-regular authoritative/auxiliary entry | Fail without deleting or traversing it. |

The editor retains its loaded token independently from edits. A conflict keeps those edits and export available, disables Save, and announces that another saved generation changed. The message and reopen action share the actual feedback scroll target and a live region. Reopening asks explicitly whether to discard unsaved edits; cancelling retains them. Successful Save advances its own token while preserving existing first/dirty/repeated-save revision and calculation rules. Load failures and opaque data expose persistent read-only recovery/Retry, with no Save, Calculate or Import controls. Export and clipboard use the same frozen editable snapshot.

The wizard's existing aggregate import now conditionally writes the sidecar generation it read; stale/opaque sidecars prevent adopting the imported workspace. It still writes sidecar first and workspace second. A failure between those stores is explicitly outside this slice's atomicity claim.

## Verification and review

- Real-filesystem suite: **64/64 passed** across 38 new sidecar cases, 24 existing workspace cases and two authoring cases (`.artifacts/sidecar-storage-tests.log`). Coverage includes both frozen-caller mutation directions, delayed cross-instance ordering, read-before-write ordering, exact backup/corrupt-byte retention, future/opaque/wrong-case states, immutable snapshot copies, exact-byte conflicts, root aliases, cross-store exclusion, unrelated roots, export freezing and failed-queue recovery.
- An additional constructed old-primary-moved case passed, proving exact backup recovery while retaining a complete temporary payload, then preserving it again on the next write (`.artifacts/sidecar-interruption-state-test.log`). This brings ordinary focused coverage to 111 distinct passing cases; it is a disk-state fixture, not a killed process.
- Editor/wizard/navigation regression suite: **43/43 passed**, including six new conflict/recovery widget cases (`.artifacts/sidecar-ui-regressions.log`). The final six-case rerun also passed after moving the conflict announcement/action into view, with hit-testable feedback assertions (`.artifacts/sidecar-editor-final-tests.log`).
- Three added wizard import cases passed for normal revision advancement, a controlled generation change between snapshot/read and write, and future-sidecar refusal (`.artifacts/sidecar-wizard-import-tests.log`). The conflict test injects bytes directly at a provider boundary; it does not claim a second application process.
- Focused Dart analysis: no issues (`.artifacts/sidecar-analysis.log`). Formatting passed. The dependency lockfile is unchanged.
- Built `juris-mobile-ffi` from this worktree, then ran the existing real-native editor tests: **2/2 passed** (`.artifacts/sidecar-native-build.log`, `.artifacts/sidecar-native-editor-tests.log`). DLL SHA-256: `e40f4e7c00d7e36c87985e7f3a5e4f946fa23a0bb390a9f41885cde4e3b468dc`. This is a host widget/native/disk test, not device process-death evidence.
- Root and an independent reviewer inspected the coordinator, preservation decisions, conditional callers and six widget cases and found no material issue. The final feedback placement addresses a local review finding: an announcement above the long form could be out of view after Save. Independent review did not rerun the suites or claim application acceptance.

## Remaining acceptance

The reviewed implementation was committed as `a191f2bae74430e48cabbfb5ea5fd0198fe4a9df`, then reconciled without conflicts with canonical main `bb49049a318059993b47e557770a517b2d0838d9` in integration commit `53cc03bc74d0aaf69447d333f63eb805df408a82`. After that integration, the mobile DLL was rebuilt and both real-native editor tests passed again (`.artifacts/sidecar-integrated-native-build.log`, `.artifacts/sidecar-integrated-native-editor-tests.log`); integrated DLL SHA-256 is `656bb5a3ed6f85f86dfd6cee056457d8ca71bf9510f1d8e7097bf3c7ae984989`. The generated web assets/source/corpus verification also passed under pinned Node 22.23.2 (`.artifacts/sidecar-integrated-web-assets.log`). This receipt update changes documentation only.

The candidate is a dependent branch, not a main-branch acceptance claim. PR #69 and the candidate's own applicable gates must pass before ordinary reviewed integration. Record the final source/run/artifact identities separately from the earlier local dirty-tree receipts; the final source is recorded in the PR after this documentation commit.

Controlled Android/iOS process termination at temporary-verification and old-primary-moved boundaries remains open, together with exact bytes/PIDs, recovery UI and fresh native recomputation where editable. Stopped-app constructed states are useful complementary evidence but are not controlled interruption proof. Spoken screen-reader, complete touch traversal, physical devices, power-loss durability, multiple Dart isolates and cooperating processes remain separate acceptance.

The aggregate sidecar/workspace journal, recovery before either store is loaded, matched store-root injection, and atomic pair conflict policy remain a separate Slice B. Workspace autosave still uses its existing non-conditional public API. This slice does not claim aggregate atomicity, mobile release acceptance, or web/PDF tax-v2 integration.

## Opaque original export correction

Review of candidate `9af1f1028d5da07a89bf7b89054ffdade2189095` found that preserved disk bytes did not imply an exact recovery export. The existing map export and clipboard re-encoded an opaque primary: Dart changed `18446744073709551617` to `18446744073709552000.0`, changed `1.2300e+0` to `1.23`, and changed whitespace/escape representation. UTF-8 decoding also consumed a leading BOM. The original sidecar itself stayed unchanged.

The snapshot now exposes immutable `originalJson` separately from its detached parsed artifact. `exportOriginal(snapshot)` writes and verifies that exact valid UTF-8 payload, including a retained BOM, without reading the current disk generation or re-encoding numbers. The untouched opaque-primary recovery UI uses it for both the export file and clipboard. Editable and conflicted edits continue to use their frozen map snapshot; the compatibility map export remains a semantic JSON export and does not promise the original token representation. Malformed UTF-8/JSON remains preserved on disk and blocked by the existing recovery path.

Both new opaque-primary widget fixtures failed on the previous implementation, with and without a BOM (`.artifacts/sidecar-opaque-export-before.log`). After correction, the complete sidecar store/recovery widget suites passed **50/50**, including five new cases: exact exported file/clipboard bytes; large numeric tokens, CRLF, whitespace and escapes; immutable original snapshot despite detached-map mutation and later disk changes; delayed provider; unique repeated exports; and absent-original refusal (`.artifacts/sidecar-opaque-export-after.log`). Existing unsaved/conflicted edit export coverage passed in that run. Focused analysis reported no issues (`.artifacts/sidecar-opaque-export-analysis.log`), and formatting/diff checks passed. These are local disk/widget checks, not a claim about platform clipboard normalization or actual application interruption.
