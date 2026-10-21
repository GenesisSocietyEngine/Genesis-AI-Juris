# Native Import probe: successful application phase, failed log collection

## Actual boundary

PR174 candidate `4434056ba3da3e03b145fd3d0989fb2708f36cd1`, run `39599951215`, reaches legacy-write after successful write/read/incomplete-write/incomplete-read phases. Legacy-write's real driver reports All tests passed, retains its complete 44,903-byte application receipt and editor image, and completes the three synthetic focus/Cancel probes plus original native legacy import/calculation/save assertions. The outer phase then fails when draining its owned system log: the unchanged 4 MiB capture limit has been exceeded. Legacy-read does not execute, so this is not a six-phase acceptance pass.

The retained raw prefix contains 2,780 events, all from exact Runner PID 47895 and its verified installed executable. Only 91 have the installed Flutter framework sender; 2,689 come from other native frameworks, predominantly MediaToolbox, UIKitCore, AVFCore and AudioToolbox. No framework_failure record is present. The raw original log is 4,190,965 bytes, SHA-256 `321cbcaeccb01a5330fab2ea8edf7a9f23483a0c8a8016e97d56403e57ab18aa`; legacy application receipt SHA-256 `aebac4b121a75aad948cebaf41c15002bbff897db657b4fe06a219e1f04d28e7`. Original artifact/log files remain unchanged under `.artifacts/import-probe-39599951215/` in the release checkout; derived counts are in its adjacent review JSON.

This is a demonstrated collection-scope failure after successful application execution. It is distinct from both the earlier fresh-VM discovery timeouts and historical `287d086`'s AnimatedPadding assertion after pressing Import while dismissing focused text input. The original assertion still lacks its construction stack/inset values; this new application pass does not resolve its root cause.

Companion run `39599941532` is also retained before the correction is pushed. It completes the same legacy-write application journey and then fails the same post-driver 4 MiB log drain; it does not reach legacy-read. This independently confirms the collection boundary without supplying a padding recurrence. Both original failed artifacts remain unmodified.

## Bounded correction

The live stream and bounded history queries now require the exact installed Flutter framework sender as well as the existing exact executable (and fresh PID for history). This is the same sender already required for every accepted VM announcement. It excludes unrelated native audio/video traffic before collection instead of raising the byte limit. Apple documents sender-based simulator filtering in [Getting the Most Out of Simulator](https://developer.apple.com/videos/play/wwdc2019/418/).

The 4 MiB stream/1 MiB history bounds, 60-second discovery deadline, three backfills, original framework-error forwarding, authenticated loopback URI, OS event identity, exact bundle/PID/source/nonce and all original data/carrier checks remain unchanged. No application inset, pinned SDK, case payload or production binding changes. Broad read-only failure diagnostics remain separate; the scoped capture is not claimed as all native-framework logging.

New launch proofs use tax-ios-system-log-launch-v2 with an explicit flutter-framework-v1 policy and exact predicate. The retained verifier checks every scoped raw stream/history record against that executable/PID/sender and verifies the exact history command. Unrelated non-VM rows, foreign IDs/paths and unrecognized policy/predicate fail. Original v1 proofs retain their original verification path and are not relabelled as scoped captures.

Portable controls pass 58 discovery tests, 13 diagnostic tests and 11 deadline controls (two Windows-specific skips). The new verifier also reproduces the original a20025c six-phase verification JSON unchanged. These are local controls, not Mac execution of the new predicate. Current companion `4434056` execution is retained before updating the native branch; new actual native workflow acceptance remains required after the correction is pushed. Keep the native slice separate from public catalogue v160 preparation and retain every failed run.
