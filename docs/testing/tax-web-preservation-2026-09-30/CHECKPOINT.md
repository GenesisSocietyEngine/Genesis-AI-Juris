# Web preservation development checkpoint

PR [#76](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/76)
was normally merged on 2026-09-30 at 18:05:38Z after all 18 applicable checks
passed at reviewed head `409208e412cc677c7a23a4c32acc4453852c94d1`.
Merge commit is `3749593df4e249cd9e4ea0e69caf22d47cef43cb`.
This accepts the bounded preservation/codecs/authoritative-route development
checkpoint, not P4C editor adoption, P5 report activation or product release.

The original `00b1e39` web runs failed the dependency audit for Next.js 16.3.4
advisory GHSA-vcvr-r3jv-pc5j. The reviewed patch pins Next.js and its ESLint
config to 16.3.8; both full and production audits report zero vulnerabilities.
Audit thresholds and preservation assertions were not relaxed. Earlier local
and hosted failures remain source-specific; see [review](REVIEW.md) and
[dependency audit](DEPENDENCY_AUDIT.md).

## Rust execution and web validation at `409208e`

Both hosted Node 22.23.2 runs independently matched all 49 complete Rust
responses (30 native + 19 web) in emitted browser, RSC and SSR execution
against exact Git fixtures, including canonical source cases/fingerprint.
Missing/corrupt WASM and blocking-CSP controls passed. Each main suite reported
1,097 passes, three skips and zero failures (1,100 total), plus two passing
D1 migration-breakpoint tests. Existing PDF visual jobs passed separately; this is not tax-v2 report
or PDF activation evidence.

| Event | Run / web job | Artifact / bytes / SHA-256 |
| --- | --- | --- |
| Push | 36747969321 / 109998912781 | 11112934232 / 831,932 / `e36ee5ec82fd0d04a374f77373f5c9047242542b84fd60441b420c4b226ae916` |
| PR | 36747973334 / 109998926715 | 11113144041 / 832,143 / `6bdbda3bd77a850069b2f428eab68d4e8d4f0eaf4f13a704e967f559747eb7ec` |

Both hosted packaging receipts have SHA-256
`cb260fa61ed18f9ffe876b4ce112eaffcc4a5d56c9d181c8b7dc24b676569a87`.
The separate clean-head local build/packaging run used Node 24.21.0 and passed
the same complete execution matrix and initialization controls. Local receipt
SHA-256 is `7f40e65edf0182848ed32354e1adf72a52d0adf009bd4f48ae74aa8b8e09c36a`;
application input SHA-256 is
`9a151dc74301c9df5dd0a431c240904e980c2de09c339b2aca947b1292a02351`.

## Executed iOS gates at the same reviewed head

Both native events explicitly executed and passed
`RunnerTests.testNativeLogisticsLifecycle()`, initial arm64/x86_64 and prepared
x86_64 archive audits, all 27 fake fixtures and eight real macOS fixtures.

| Event | Run / job | XCTest UTC / duration | Artifact / bytes / SHA-256 |
| --- | --- | --- | --- |
| Push | 36747969279 / 109998912544 | 17:25:49.317786Z / 0.260 s | 11115195753 / 180,455 / `e20f02c8470a590f5cf972e19d52f9d8f6d43c9062de667c45485f8f59699603` |
| PR | 36747973243 / 110000397823 | 17:43:33.316786Z / 0.215 s | 11116090396 / 179,723 / `960dfc9eedb0fe62d92c58d178149954dc81510980668e92e935a57919a9ada9` |

Both application events executed the selected write/read tests in two distinct
terminated processes. Each independently verified the complete saved artifact,
scenario/progress and fresh native request/result pairs, two actual native
calculations, screenshots and both x86_64 export audits.

| Event | Run / job | PIDs | Artifact / bytes / SHA-256 |
| --- | --- | --- | --- |
| Push | 36747969341 / 109999575878 | 43563 → 56187 | 11116636378 / 392,136 / `c186c6fa20aade3046066cc8d696cf8c093df6a3259bd124ef0651485689ff00` |
| PR | 36747973233 / 109998928685 | 49919 → 62950 | 11115619626 / 386,665 / `ed6e8fe55b1480ac5d4de166e9ff054346127fe9a0805fee0aaabe0e41e1c95c` |

Full application log hashes are
`5279ff004db7f21175fd4e46fc159a96135883972891e13d6701e764967d04e4`
(push) and
`b155db0e446748130db762e4d130e2ccd072d16d976a16bbbf09c5f2fbd9aa13`
(PR). The reopened push screenshot visibly shows saved status and EUR 50,000
annual benefit, EUR 500,000 lifecycle benefit and EUR 347,634.95 NPV.
These are two-phase PR-head results; they do not establish PR #72's six-process
unchanged-bundle journey or physical/audible-screen-reader acceptance.

The local retained evidence root is `.artifacts/pr68-ios-2026-09-30/`:
`ios-web-preservation-409-{push,pr}-receipt.json`,
`ios-application-web-preservation-409-{push,pr}-receipt.json`, and the
`ci-checkpoint-962-543-409/` raw metadata/log/ZIP transport and full web-response
verification directories. All four iOS archives were independently checked
against server digest/size/CRC and exact run/job/attempt/source. The final
all-gate remote readback is `pr76-all18-readiness.json`.

## Subsequent main and remaining acceptance

Main source `3749593df4e249cd9e4ea0e69caf22d47cef43cb` separately passed all
nine jobs across six workflows. Its native run `36756101148` / job
`110027512876` explicitly passed the selected XCTest at 18:38:20.751493Z
(0.272 s), both archive audits, 27 fake and eight real fixtures. Artifact
`11117749852` (180,133 bytes), SHA-256
`33c48422234efe5ae58c80f03fca4392be7a1a1997def027450fe832f076cc7a`, is retained
with raw log SHA-256
`8fd5a7d487fb0fc1c562fa92474729dfa8368e576f3d6d4e579991fa498b365d`.

Its application run `36756101067` / job `110026612290` passed the selected
write/read phases, PIDs 42148 → 58200, exact saved/native pairs, both fresh
calculations, process termination, screenshots and x86_64 audits. Artifact
`11117274680` (386,705 bytes), SHA-256
`07cf795529c0725465587c49918238548ee506cea947f398d9cbca0e866a871d`, and full
log SHA-256 `6797e97eb11e62d065cf35740a4f462fce7ff3ddd0ec3d752267502ec8bc4950`
were independently retained and verified. Main receipts are
`ios-preservation-main-374-receipt.json` and
`ios-application-preservation-main-374-receipt.json` under the evidence root.

Main web/PDF run `36756101054` / jobs `110026611915` and `110026612237`
independently verifies all 49 complete Rust responses per emitted host, exact
source fixtures, initialization controls and zero-vulnerability audits, using
Node 22.23.2. Artifact `11116618968` (830,767 bytes), SHA-256
`9458b551f20913494801d4f9ae014fe82e4329c5cff3488a759a31519a61762d`, contains
packaging receipt SHA-256
`f8c27c95111f6416b7de9950580f1839436b3891257777a05d803793ba931acd`.
The same 1,097 passing tests, three skips and two passing D1 migration-breakpoint tests are recorded.

No PR-head result is relabelled as main evidence. Older main `0590eaf` retains
its separately successful application/web runs and cancelled native run. The
prior `00b1e39` cancelled native PR/application push and separately successful
events likewise keep their original labels.

At this foundation checkpoint, P4C editing and P5 version-bound report/PDF
integration were remaining work. They subsequently passed the separate
[PR #77 development checkpoint](../tax-report-model-2026-09-30/CHECKPOINT.md).
The six-phase iOS matrix, iOS interruption recovery and mobile physical/accessibility
checks remain separate. At this foundation source, reopened
unverified lineage still blocks saving while preserving edits; prior-carrier
authority remains memory-only. Markdown prompt import retains its existing
64,000-character UI limit. No deployment or full release is claimed.
