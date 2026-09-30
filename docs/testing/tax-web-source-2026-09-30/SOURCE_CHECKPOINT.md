# Web source contract checkpoint

PR #74 head `fe8839520aff06772d30b6eef81d859fb4e71174` passed all 16 applicable
push/PR checks and merged normally as
`d4d2902916951f51da0123c243c9945fd5bc807c` at `2026-09-30T15:13:38Z`.
Main was freshly checked before merge; root independently reviewed the source
projection, Rust boundary, native compatibility and complete host parity receipts.
This accepts P4A development, not web editor or tax-v2 PDF product integration.

## Exact PR-head evidence

| Evidence | Run / job | Retained artifact | ZIP SHA-256 |
| --- | --- | --- | --- |
| Web/host parity | 36728587730 / 109931829083 | 11104029104 (827,949 bytes) | `564cedeb36f45a7528f5846e5921e8758797e49e8416cb72a622f9c9cbe7aecb` |
| Regeneration | 36728587610 / 109931827734 | 11104540024 (257,827 bytes) | `a1d3279099a4de877b1808a6433a2c43176ae8f1f58374f94f4e0a890bcda625` |
| PR native iOS | 36728587717 / 109931829321 | 11106675191 (180,235 bytes) | `70138e68c5c41e01acb08894ee5ffef6de908273c79cf9372fff2069befee50e` |
| Push native iOS | 36728580200 / 109931801230 | 11106007303 (180,641 bytes) | `14c74a114d012f56e381083b5bfca48080c03c5c6d4c1cf68bc7662cdd3fa903` |

The hosted web suite passed 1,030 tests with three skips. Chrome 153.0.8010.52
(Turkish locale), Node 22.23.2 and workerd 1.20260911.1 returned all 49 complete
native reference responses: 30 unchanged native executions plus 19 web-command
executions, not 49 independent financial scenarios. Each host derived identical
canonical source bytes/fingerprint and exercised the production repository.
Missing/corrupt/CSP-blocked WASM failed closed. Root compared all response arrays,
canonical edge cases and every regenerated artifact byte against committed files.

Combined response SHA-256:
`7994cd1e89ec16581766c5a59f16e71e999a5ff6c872b6c11cad80a82240433c`.
Canonical source fingerprint:
`dc19c89badf2fa905c3ab0333a08c365115c6e4462a10d5e1855585a0402fb93`.
WASM: 926,022 bytes, SHA-256
`2dfdd6b2961b8965c3ab92d9976f32b4a4b1ccbc3c9a0aac0594b7c05d68510d`.

Both iOS jobs explicitly executed `RunnerTests.testNativeLogisticsLifecycle()`:
PR passed at `15:02:04.264820Z` in 0.277 seconds; push at `15:07:41.606991Z`
in 0.418 seconds, both attempt 1. Initial archives were `arm64 x86_64` and
prepared archives `x86_64`; both export audits, 27 fake cases and eight real
macOS thin/universal fixtures passed. Diagnostic artifacts include prepared source
identity and execution logs. Root retained receipts under
`.artifacts/pr68-ios-2026-09-30/web-source-fe883-*` and `ios-web-source-fe883-*`.

## Subsequent main evidence

Main `d4d2902916951f51da0123c243c9945fd5bc807c` has separate runs: Flutter
`36735103115`, Android `36735103146`, Rust `36735103170`, web/PDF `36735103091`
and native iOS `36735103085` / job `109954624273`. Flutter, Android, Rust and
web/PDF passed. Native iOS was cancelled when subsequent main superseded this
commit; no passing XCTest receipt is established for this main run. The accepted
PR-head runtime evidence above remains distinct. Later main
`33c5c7867acf70add458ebee926db17d89b69711` has its own checks, recorded in the
mobile recovery checkpoint; it cannot turn the cancelled d4d2902 run into success.

## Remaining acceptance and separate findings

P4B must preserve exact known/incomplete/unsupported attachments across local and
server storage, auth continuation, revisions and export/import. P4C must exercise
actual edit/calculate/save/reload and asynchronous authority fences. P5 must bind
fresh shared-Rust results to versioned report output, exact values, PDF extraction
and visual parity. Existing PDF greens establish only the existing report baseline.

A later actual development-server check found that Vinext's dependency scanner
treats generated `.wasm.d.ts` files as executable entry points. Declaration,
configuration, runtime plugin and lockfile are unchanged between accepted main
`bb49049` and this head: the finding predates P4A. P4B owns a narrow development-only
entry exclusion and a clean server/browser recheck. Production packaging parity
does not establish development-server acceptance. No deployment or release follows
from this checkpoint; physical-device checks remain open per the user's instruction.
