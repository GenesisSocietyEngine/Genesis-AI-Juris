# P4A edited web source contract

## Outcome, scope and source

An actual edited web Studio source can supply its own versioned identity to the
shared Rust tax authoring commands without inventing a native ScenarioDefinition.
An unsupported runtime fails readiness before calculation. This slice does not
wire the editor, persistence, migration UI or PDF outputs.

Worktree `tax-web-source`, branch `codex/tax-web-source-2026-09-30`, began at
`75db5dbebfba6e3b643bfaa8eaefca37097109c6`, combining reviewed runtime `2882ffa`
with canonical receipt main `99805a9`. PR #71 subsequently merged normally at
canonical main `bb49049a318059993b47e557770a517b2d0838d9`, with the same base tree.
Local development evidence below initially belongs to uncommitted changes over
that base; exact committed-head evidence must be recorded after review/publication.

Owned scope: source projection/repository, separate Rust web commands/shared
helpers, native compatibility and web protocol tests, generated assets/corpora,
actual emitted-host packaging verification and this review. Root separately owns
the included CURRENT_PROGRESS and RUNTIME_CHECKPOINT documentation updates.
No lockfile or workflow change is needed for this slice.

## Contract and review decisions

- Full known source projection includes case/version/type/parent, matter,
  classification, deal economics, every node/runtime field and link/rule field.
  Exact source strings and array order remain; tax attachment/input/cache and
  volatile audit/protection fields stay outside this source identity. Existing
  case/publication/seal hashes are unchanged.
- Canonical JSON emits sorted entries directly, including numeric-looking keys.
  Sorting is locale independent; finite numeric JSON conventions include -0 to 0,
  strings use standard surrogate escaping, undefined optional object properties
  are absent, and non-JSON/undefined array entries reject.
- Projection and exact fact/evidence index come from the same detached snapshot
  before the first crypto await. The immutable result includes canonical JSON
  and the compact descriptor, whose disjoint ID lists sort by UTF-8 byte order.
  Identifiers reject lone surrogates before TextEncoder could replace them;
  general source strings still retain standard JSON surrogate escaping.
- Rust applies strict web source schema, identifier/index/count/order validation
  before the shared authoring body. This is structural validation of caller-owned
  identity, not graph/authority attestation. Worker application integration must
  derive from authoritative saved data itself. Source hashing does not require
  sending or dropping the full graph to fit the tax command's 256 KiB cap.
- Separate `tax_web_capabilities`, `tax_web_prepare`, `tax_web_calculate` and
  `tax_web_import` reuse the same financial/request/binding/legacy implementations.
  A struct-shaped empty web capability rejects extras; the native unit capability
  keeps its prior tolerance. Ambiguous duplicate command tags remain rejected by
  the shared tag reader before either dispatcher.
- Native prepare/import intentionally retain their previous lack of source-index
  validation. Native calculation retains request/source/context/index error
  precedence and cross-list overlap behavior. Shared index helpers preserve those
  errors; stricter ordering is confined to the web boundary. Mobile C ABI and
  standalone compatibility exports are untouched.
- Host-neutral repository freezes source and command arguments, checks both
  runtime and web capabilities and caches readiness failure. It returns complete
  raw Rust responses without adopting results or performing financial fallback.
  Async UI adoption/save fences remain the later editor's responsibility.

## Local review and verification

- Before refactoring, three new native edge regressions passed against the
  unchanged dispatcher: duplicate/oversized prepare/import indexes, calculation
  error precedence, cross-list overlap and capability extras. The same three and
  all four existing native tax command tests passed after refactoring.
- Four new Rust web-boundary tests passed: strict extras/duplicate rejection,
  real web identity and calculation, schema/UTF-8/order/count validation on all
  operations, and raw payload/canonical revision limits.
- Seven TypeScript source/repository tests passed: pinned full canonical bytes
  and independent SHA, every source leaf, excluded metadata, numeric/Unicode/locale
  canonical cases, mutation during hashing, exact ID constraints and frozen
  arguments/readiness failure. Initial typecheck found a test-only BigInt literal
  incompatible with the project's target; the test now uses `BigInt(1)`.
- The new 19-command native web corpus completed successfully during WASM
  generation. It covers capability/preparation, both legacy imports and unavailable
  import, amounts/downside/dated-benefit/derived/manual calculations, incomplete
  binding/manual provenance, stale context, invalid descriptor and strict capability.
- Rust tests for `juris-tax-economics`, `juris-mobile-bridge` and `juris-tax-wasm`,
  tax tests without default features, warnings-as-errors Clippy, Rust 1.78 WASM
  compilation and rustfmt passed. The final web-only ID tightening was followed
  by another native edge/web boundary run, Clippy and Rust 1.78 compilation.
- Strict TypeScript and focused ESLint passed. The 25 focused source/runtime/
  security tests passed; after correcting the Unicode fixture, all 14 source/
  runtime tests passed again, including exact native Node/WASM response parity.
- Pinned generation and a subsequent independent `--rebuild-check` passed with
  every byte equal. `Cargo.lock`, `package-lock.json` and the original 30-command
  native corpus remain unchanged. The generated WASM is 926,022 bytes, SHA-256
  `2dfdd6b2961b8965c3ab92d9976f32b4a4b1ccbc3c9a0aac0594b7c05d68510d`.
- The real Vinext build and emitted client/RSC/SSR packaging check completed
  successfully on Node 22.23.2, Chrome 138.0.7204.97, Miniflare
  5.20260911.0-alpha and workerd 1.20260911.1. Each host returned all 49 complete
  native reference responses exactly. Combined response SHA-256:
  `7994cd1e89ec16581766c5a59f16e71e999a5ff6c872b6c11cad80a82240433c`.
- Browser (Turkish locale override), RSC and SSR independently derived the same
  full canonical source bytes and fingerprint
  `dc19c89badf2fa905c3ab0333a08c365115c6e4462a10d5e1855585a0402fb93`,
  verified numeric-key/Unicode fixtures and mutation during hashing, then called
  the production repository to prepare the exact same Rust response. Browser
  missing/corrupt/CSP-blocked assets failed closed; ordinary JS eval remained
  blocked; Worker initialization used imported precompiled WASM.
- The first emitted Worker run correctly failed an exact Unicode expectation:
  an earlier PowerShell pipe had replaced fixture literals with question marks.
  Corrected ASCII-escaped fixture generation writes UTF-8 directly; the stored
  canonical edge fixtures now also run in the Node test. No production algorithm
  or equality requirement was weakened. The successful rerun supersedes that
  failed local attempt.
- Independent root review covered projection, repository, native refactor,
  strict web commands, generator and emitted-host proof. Its two identity
  findings were fixed: lone-surrogate identifiers reject before UTF-8 encoding,
  and web fact/reference indexes must be disjoint. Native overlap remains tested.

Local receipts, complete response arrays, source proofs and visually inspected
screenshots are retained under `.artifacts/tax-runtime/packaging/`, with logs in
`.artifacts/tax-runtime/logs/`. This initial receipt explicitly records
`sourceCommit:null`, `workingTreeClean:false`, base `75db5db`; it is evidence for
the reviewed uncommitted candidate, not the old main source. Its application
input digest is `b3dbf00e78f82788585c00048ae21504b2371952409593b5b07ca2d63bac00f3`
and Rust input digest is
`db655dcef45d3ba98c727ee072b4cd8016cdf30eb9367df38608483270117ab3`.
A clean committed-head build/packaging receipt and applicable CI remain required
before acceptance. Existing web/PDF greens do not establish tax-v2 editor,
persistence or report integration.

## Remaining separately reviewed slices

P4B must preserve versioned known/incomplete/future attachments across device and
workspace storage, downgrade/omission guards, sealed JSON/Markdown, undo, AI plans
and reclassification. P4C must provide actual edit/calculate/save/reload journeys,
stale-response/authority fencing, exact money editing and accessibility evidence
while disabling legacy write-back/fallback for v2. P5 must freshly compute and
bind versioned report output in browser/Worker/Node, including PDF extraction,
staleness and visual acceptance. None is claimed by this source-only slice.
