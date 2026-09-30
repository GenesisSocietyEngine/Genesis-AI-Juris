# Shared Rust web runtime checkpoint

PR #71's corrected head `2882ffa0ee81e7f885a35f25639970b537290b9b` passed all 16 push/PR checks and merged normally as `bb49049a318059993b47e557770a517b2d0838d9` at `2026-09-30T13:53:17Z`. Fresh canonical readback verified containment and the expected tree, including PR #70's documentation. This record concerns the PR head; main-branch workflow results must be recorded separately.

## Executed and retained PR-head evidence

| Gate | Run / job | Retained artifact and SHA-256 |
| --- | --- | --- |
| Windows full-byte regeneration, PR | [36721397427](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36721397427) / `109907139553` | `11100535894`, `tax-runtime-regeneration-36721397427-1`, 243,990 bytes; `4dec9e0d8754fda900e7efd74f93e2f8e16370f75b8567f5a2935d486a65baa4`; expires `2026-10-14T13:27:20Z` |
| Windows full-byte regeneration, push | [36721387665](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36721387665) / `109907105931` | `11099167236`, `tax-runtime-regeneration-36721387665-1`, 243,995 bytes; `2a4adcad91b1d32f6d709feee161206d18d9c9d1d11146ee1a8c4833237520f4`; expires `2026-10-14T13:27:53Z` |
| Full web checks and actual emitted browser/Worker runtime, PR | [36721397747](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36721397747) / `109907140780` | `11101775518`, `web-diagnostics-36721397747-1`, 810,605 bytes; `935dc68c361f6f666549faaebbe111c60bf51ee2a4c17d3175ba88f8f1e0ce03`; expires `2026-10-14T13:32:29Z` |
| Native iOS, PR | [36721397413](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36721397413) / `109907142498` | `11101878308`, `ios-native-36721397413-1`, 180,490 bytes; `6ee11183cefad00074b616c3ab8bb30ad032e7a78d8e19283ea473f77061ef9a`; expires `2026-10-14T13:51:23Z` |
| Native iOS, push | [36721387799](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36721387799) / `109907895635` | `11102333432`, `ios-native-36721387799-1`, 180,337 bytes; `9334261330a2dcfd1e005e316a8e0c46495885c45043054eeeaec14ad285d9a9`; expires `2026-10-14T13:51:49Z` |

Both iOS jobs explicitly executed `RunnerTests.testNativeLogisticsLifecycle()`: PR passed at `13:51:21.868214Z` in 0.347 seconds, push at `13:51:47.252386Z` in 0.220 seconds, both attempt 1. Initial product archives were `arm64 x86_64`; prepared archives were `x86_64`. The 27 fake verifier cases and eight real macOS thin/universal fixtures passed in both jobs. Both native artifacts were downloaded and independently checked.

Hosted packaging used Node 22.23.2, Miniflare `5.20260911.0-alpha`, workerd `1.20260911.1`, and Chrome `154.0.8037.57`. Its receipt records exact source and a clean working tree, web inputs digest `9f962e75c100fb1065a45043d0a202003d631be6c1f8152a1f5c94f7e875cf2d` and Rust inputs digest `2e2911dea48bb4591421dad50a37790fd251d86948fa7cb92b2b61e99553ae35`. Every generated artifact was independently compared against the downloaded regeneration receipt and committed files. All three retained host response arrays matched the complete native corpus. Runtime initialization remained cached; missing/corrupt/CSP-blocked assets failed closed; JavaScript eval and Worker dynamic compilation remained blocked. The separate local Chrome 138 receipt is not relabelled as hosted Chrome evidence.

Root retained diagnostics under `.artifacts/pr68-ios-2026-09-30/web-runtime-288-{pr,regeneration}/` and `ios-web-288-{pr,push}*`, with an independent receipt verifier. WASM: 885,797 bytes, SHA-256 `0da70796c94695e8538c89d6d6dc875ea5b762b659cb9c476f02d4503357350a`.

## Subsequent main evidence

Canonical main `bb49049a318059993b47e557770a517b2d0838d9` separately completed all five workflows successfully: Flutter `36724945775`, Android `36724945806`, Rust `36724945757`, web/PDF `36724945763`, and native iOS `36724945847`. This does not replace the PR-head receipts above.

[Main iOS run 36724945847 / job 109920982401](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/36724945847/job/109920982401) explicitly executed `RunnerTests.testNativeLogisticsLifecycle()` and passed at `2026-09-30T14:13:37.169051Z` in 0.217 seconds, attempt 1. Initial archive: `arm64 x86_64`; prepared archive: `x86_64`. All 27 fake verifier cases and eight real macOS fixtures passed. Artifact `11102897766`, `ios-native-36724945847-1`, 180,005 bytes, SHA-256 `cfbc34ab808e1b42b2add3cbf815cf9284fce0fabd5339f362ad3caf4e8b133f`, expires `2026-10-14T14:13:38Z`, was downloaded and independently checked with its prepared source identity. Local receipt prefix: `.artifacts/pr68-ios-2026-09-30/ios-web-runtime-main-bb490`.

## Failure and acceptance boundary

Initial head `270529d` failed the regeneration gate because wasm-bindgen's non-executable producers metadata included an unrelated enclosing Git HEAD in the locally built CLI. The supported `--remove-producers-section` correction retained exact tool/host pins and full-byte comparison. Independent section comparison proved all executable bytes unchanged; the original failed run/job identities remain in [REVIEW.md](REVIEW.md).

This establishes shared Rust transport and actual production packaging. Generation is pinned to Windows x64/MSVC; Linux builds consume the same verified portable WASM. Cross-host generator byte identity is not claimed. The corpus has 30 executions including 25 identical calculations. Actual web-source identity, editor integration, future-content-preserving persistence, version-bound report output and comprehensive tax-v2 financial/PDF parity remain open. No deployment or product-release acceptance follows from this merge.
