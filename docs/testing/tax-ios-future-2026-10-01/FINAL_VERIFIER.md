# Future-format iOS final evidence verifier

The intended outcome is a single offline decision for the complete ten-phase
application journey. A successful build, selected-test marker, uploaded archive,
individual phase receipt or successful device cleanup cannot satisfy this
decision alone. Acceptance requires the same reviewed source, run nonce,
Simulator, complete bundle, ordered native/application evidence, restored raw
authoring inventory and final owned-device deletion.

The source-owned entry point is
[verify_future_journey.py](../../../.github/scripts/ios_tax_future/verify_future_journey.py).
It accepts `evidence source_sha run_nonce simulator_uuid`, performs no application
or filesystem mutations, and prints one JSON result only after all checks pass.
It refuses optimized Python because inherited semantic assertions must remain
enabled. It imports checked-out source modules; retained artifact files are data
and are never imported or executed. Trusted verifier modules and the export and
deadline helpers must match the requested Git tree, permitting only checkout
CRLF/LF normalization. Git reads have independent ten-second limits; the caller
must additionally bound the whole verifier by its remaining exercise deadline.

The final decision requires:

- Exact source tree, CI run/attempt, nonce, macOS identity, chosen UUID, canonical
  application/Simulator/evidence roots and the recorded Python executable.
- Real (`synthetic=False`) replay of all ten immutable phase ledgers, including
  preparation, transport, raw command output, application receipts, ordered
  process identities, selected test, native request/response semantics, complete
  bundle identity, screenshots and before/after authoring files. The shared
  replay owns the direct-driver SDK and authenticated VM protocol details.
- Successful preparation under its 900-second wrapper, every application phase
  and restoration under separate 300-second wrappers, and the existing overall
  exercise bound measured from before creation through deletion. All twelve exact
  commands require actual exit zero, complete
  hashed logs, no terminal error or cleanup error, and an ordered deadline record
  proving the owned process group absent. Application output alone is insufficient.
- Independent equality of the final authoring entries with the original raw
  projection, including empty roots and original numeric/encoding bytes; exact
  retained auxiliary/control removal; and explicit `clipboard_restored:false`.
  This run uses deletion of its freshly owned Simulator instead of claiming that
  a previous clipboard value was restored.
- Rich lifecycle start/terminal records that agree with the summarized lifecycle:
  actual supported runtime/type inventories, exact creation/boot/readiness,
  current ownership before mutation, shutdown and deletion, final UUID absence,
  and preservation of every pre-existing device identity. Timeouts, missing
  execution, truncated/error records and failure-only cleanup cannot pass.
  A command's recorded deadline may be smaller than its role maximum when the
  parent has less time left; elapsed time must fit that finite positive cap.
- Ten successful export commands, one after each completed application phase,
  with exact complete architecture output, exactly the three mobile symbols in
  every slice, no stderr or extra diagnostics, and stable archive/Runner hashes.
  The Runner identity must also match the full prepared and installed bundle.
- Bounded regular evidence reads, duplicate-key/depth/number validation and a
  final reread of every consumed file. The result includes the complete consumed
  file hash inventory; it does not treat a retained JSON declaration as a
  cryptographic attestation of a provider or device.

## Local review and validation

On 2026-10-01, the initial focused portable suite passed **16/16 groups** in
10.732 seconds. The source-integration review then added shorter lifecycle
command budgets and an explicit budget origin before device creation; the
expanded **18/18 groups** passed in 9.187 seconds. The final **19/19 groups** passed
in 8.059 seconds, retained in `.artifacts/final-verifier-tests.log`. The added CLI
negative control checks ordinary and optimized-Python failure paths for no
success JSON, no artifact execution and unchanged evidence files.
The final source-pin hardening also compares every prepared Dart/contract file
with the requested Git bytes and its pinned preparation digest. Its regression
rejects a stale pin and an uncommitted changed target; **20/20 groups** passed in
5.022 seconds (`.artifacts/final-verifier-final-tests.log`). Root reviewed this
last bounded change with no material finding.

```text
python -B -m unittest test_verify_future_journey -v
```

These controls exercise source/path/run mismatches, duplicate or changing input,
the twelve wrapper contracts, timeout/nonzero/ambiguous marker and cleanup
rejection, lifecycle raw-origin/ownership/pre-existing-device preservation,
exact original restoration and control removal, thin/universal archive output,
missing slices/fourth exports/standalone tax symbols/diagnostics, actual command
failure, altered binary hashes and real replay refusal of a synthetic ledger.
Positive lifecycle/export fixtures are explicitly fake unit inputs. They neither
invoke Simulator nor constitute a complete accepted application fixture.

Root and independent peer source reviews found the initial lifecycle budget
type mismatch and missing pre-creation budget origin; both are corrected and
covered above. The peer found no further material issue in the bounded source,
wrapper, lifecycle, restoration and export checks. Root integrated source
review found no remaining material issue. This verifier has not yet accepted an
actual macOS ten-phase run. Final committed-source CI must execute the complete
host, application, native and cleanup path. PNG structure and hashes are checked;
actual decoding and visual inspection remain separate evidence. Genuine process
interruption, power loss, physical-device checks and accessibility acceptance
remain separate gates. CI run/job and artifact API identity/digest verification
must also accompany any retained successful result.
