# P4 shared Rust runtime development slice

## Source and ownership

- Base: canonical main `bc093010bef5ffa9476aac2d68e7b2b19ebf39d5`, after PR #68 merged.
- Branch: `codex/tax-web-runtime-2026-09-30`, isolated worktree `tax-web-runtime-2026-09-30`.
- Scope: shared Rust facade, wasm-bindgen wrapper, owned generated assets, explicit browser/Worker/Node loaders, real Vinext packaging, CSP and runtime verification.
- Initial local implementation evidence was collected with uncommitted changes over that base; it is not evidence that base main contained the runtime. PR #71 first published source `270529d8d9ccdb1b3bc28707a18d641d1c4f710b`. Its clean-head Vinext rebuild and complete browser/RSC/SSR packaging checks passed. A subsequent generation-metadata correction is described below; its exact-head CI remains required.
- No changes to mobile authoring/persistence, the current web editor, report formulas, the PDF baseline, CURRENT_PROGRESS, or PR #68's review record belong to this slice.

## Intended outcome and acceptance

Web hosts can obtain a version-checked Rust tax runtime, or an explicit readiness error. They share the native tax protocol implementation and preserve complete JSON responses, decimal money and revision strings. Ordinary web deployment builds verify packaged assets with Node only. The existing mobile C ABI keeps its three exports.

Acceptance for this runtime slice is native/WASM transport parity, real client/RSC/SSR bundle execution, fail-closed initialization/version behavior, reproducible asset ownership, MSRV and existing bridge protection. Editor journeys and P5 financial/report acceptance are separate.

## Implementation and review

1. `juris_mobile_bridge::execute_tax_json` delegates directly to the existing private tax dispatcher; `MobileBridge::execute_json` calls that facade. A thin `juris-tax-wasm` crate uses exact wasm-bindgen `0.2.128` with a maintained String API. No command parser, source identity adapter, formula, C export, unsafe allocation protocol or JavaScript financial fallback was added.
2. Host loaders initialize from a Vite URL, a Cloudflare precompiled `WebAssembly.Module`, or Node filesystem bytes. Readiness checks protocol/schema/calculation/policy/currency/size capabilities. Success and failure are cached; failed initialization requires module/application reload. Unrecognized commands are explicit errors at the host adapter.
3. The asset generator uses pinned Rust `1.95.0` on Windows x64/MSVC, locked dependencies, a size-oriented profile, explicit path remapping, disabled incremental compilation, and cleared ambient compiler/profile overrides. The deterministic receipt hashes Rust source, manifests, lock/tool files, compiled-in data and output files. Node verifies it without invoking Rust. A dedicated `windows-2022` Rust CI job regenerates and compares every byte. Rust panic strings retain host path separators: same-host reproducibility is claimed, not Linux/Windows generator byte equivalence. The generator checks and records its host; ordinary Linux builds consume and verify the same portable WASM without Rust.
4. Vinext emits explicit lazy runtime entry chunks in the client, RSC and SSR builds. Manifests bind those chunks to the application source digest; the packaging verifier rejects stale output. No public diagnostic endpoint was added. The production CSP adds only `'wasm-unsafe-eval'`; JavaScript eval remains blocked.
5. Root review identified an obsolete broad `unsafe-eval` assertion and a CI pipe that needed explicit pipefail. Both were corrected. Independent review checks the boundary, generation, packaging and failure behavior. The isolated reproduction initially lacked compiled-in content; the receipt/input copy was corrected and the complete second build matched byte-for-byte.
6. The initial hosted regeneration gate correctly failed on source `270529d` (PR run `36720051608`, job `109902555885`; push run `36720039032`, job `109902507764`). Retained CI WASM and local WASM differed only in the final `producers` custom section: the locally built CLI embedded `0.2.128 (262cf2f77)`, while CI embedded `0.2.128`. Upstream wasm-bindgen's build script reads the Git HEAD enclosing its Cargo registry. The correction uses the supported `--remove-producers-section` flag and records `producersSection: false`; exact tool pins and full-byte comparison remain enforced. An independent section comparison proved every other byte matches both original builds. Rebuilt receipts and native corpora now remain in staging diagnostics on failure.

## Local evidence

| Check | Observed result |
| --- | --- |
| Pinned generation | Rust 1.95.0 / wasm-bindgen 0.2.128; succeeded |
| Independent source directory, same Windows host | Regenerated JS, declarations, WASM and native corpus all match every owned asset byte |
| Rust 1.78 WebAssembly check | `cargo +1.78.0 check --locked -p juris-tax-wasm --target wasm32-unknown-unknown` passed |
| Existing native bridge tests | 29 tests passed, including tax commands and existing gameplay/session preservation |
| Rust lint/format | Clippy for bridge and wrapper, all targets with warnings denied; rustfmt passed |
| New Node runtime tests | 6 passed, including complete response parity, unsupported/oversized/invalid requests, cached initialization and capability failures |
| Existing domain/security tests | 11 passed with the narrow CSP assertion |
| TypeScript and focused lint | Passed after generated output was available; generated files are excluded from handwritten-source lint |
| Actual production bundle | Vinext 1.0.0-beta.8 / Vite 8.2.2 client, RSC and SSR build completed |
| Emitted Worker chunks | Real workerd 1.20260911.1 via Miniflare 5.20260911.0-alpha; both RSC and SSR full native corpus parity, cached readiness, dynamic compilation still prohibited |
| Emitted browser chunk | Chrome 138.0.7204.97; full native corpus parity under production headers, JS eval prohibited |
| Browser failure paths | Missing asset, corrupt WASM and CSP without the WASM allowance all reject readiness and retain the same failed promise |
| Full existing web suite before generation-metadata correction | 1,025 tests: 1,022 passed, 3 skipped, 0 failed; terminal exit 0; started during local review before publication, so exact-head CI remains separate |
| Generation-metadata correction | Generate/rebuild-check and Node-only verification passed; all 17 runtime/security tests passed again; non-telemetry section bytes equal both original local and hosted CI WASM |

The corpus contains **30 executions**, comprising capability discovery, preparation with revision `9007199254740993`, two legacy imports retaining original JSON, **25 repetitions of the same successful calculation**, and one incomplete-rates error. Every complete response string is compared. This is transport parity, not 30 distinct financial scenarios or comprehensive P5 financial/report parity.

The complete response corpus is 75,695 bytes before its final newline, SHA-256 `02d015f9a2a09ac23cbcc3a5d823dd792213499368edcd41b57f8df8f995b073`. The corrected generated WASM is 885,797 bytes, SHA-256 `0da70796c94695e8538c89d6d6dc875ea5b762b659cb9c476f02d4503357350a`. Initial source `270529d` used the functionally identical 885,871-byte asset with CLI telemetry, SHA-256 `b6bdb9777fd60905f58fa7ee0fd8c72199ce7984de70ecb8cbfa548ff48be514`.

Retained local diagnostic directory: `.artifacts/tax-runtime/packaging/` (receipt, complete per-host responses, Chrome diagnostics and four screenshots). Receipts label dirty source explicitly and include Rust/web source digests. The CI jobs retain exact-head generation and packaging diagnostics for 14 days. Initial local Node execution was blocked by the Windows sandbox's `uv_os_get_passwd` error; the same bounded tests passed outside that sandbox. Initial test-server paths were corrected to the observed Vinext `_next/static/{chunks,media}` paths before browser acceptance.

## Remaining acceptance

- Exact final-commit rebuild/packaging evidence and remote CI results, including the pinned Windows generator's byte reproducibility and all existing mobile export/XCTest gates.
- Reviewed web Studio source identity projection, editor invocation, persistence, incomplete/future/legacy source handling and application journeys.
- Version-bound tax-v2 report/PDF output and broader native/web/report parity scenarios.
- Mobile P3 application/device acceptance remains under its separate workstream; this runtime slice closes none of those device gates.

## Primary implementation references

- [Cloudflare non-JavaScript modules](https://developers.cloudflare.com/workers/vite-plugin/reference/non-javascript-modules/): precompiled `.wasm?module` imports.
- [wasm-bindgen deployment](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html): explicit web-target initialization.
- [wasm-bindgen CLI](https://wasm-bindgen.github.io/wasm-bindgen/reference/cli.html): supported removal of the producers telemetry section.
- [Vite WebAssembly](https://vite.dev/guide/features.html#webassembly): explicit asset URL loading.
- [wasm-bindgen 0.2.128 metadata](https://raw.githubusercontent.com/wasm-bindgen/wasm-bindgen/0.2.128/Cargo.toml) and [CLI metadata](https://raw.githubusercontent.com/wasm-bindgen/wasm-bindgen/0.2.128/crates/cli/Cargo.toml): runtime library Rust 1.77 minimum; CLI Rust 1.86 minimum. Actual repository wrapper compilation was checked on Rust 1.78.
