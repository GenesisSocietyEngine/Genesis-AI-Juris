# CI stabilization — 29 September 2026

## Ownership and intended outcome

Root Codex is the sole implementation writer in fresh full-history remote clone `C:/PROJECTS/Genesis-AI-Juris/.worktrees/ci-stabilization-2026-09-29`, branch `codex/ci-stabilization-2026-09-29`, starting at current remote main `b355caf36fbb27c31a338520fdfeef9649afadc3`. The clone is owned by the current Windows user; no Git ownership override is used. Claude is the assigned independent source reviewer. A separate Codex agent performs read-only iOS/acceptance evidence research, which is not labeled Claude review.

Initial owned paths: `package.json`, `package-lock.json`, and this task's evidence. Existing integration checkout is clean at b355caf. The outer workspace remains on `feat/professional-product-ui-redesign-pilot-v2` / `6ca50f24ab3a763ac80e5cd221c15db4a7592fd8`, with unrelated `Cargo.toml` and `docs/development/CURRENT_PROGRESS.md` edits owned by the other execution; they are preserved. The original canonical checkout remains `5873ed4` with its intentional 19 untracked evidence/support files. The sandbox-owned amendment checkout and dependency junction are not used for execution or modified.

User outcome: retain existing application behavior while restoring the required full dependency audit. Acceptance: minimal compatible patch-level dependency changes, lock-enforcing fresh installation with no lock mutation, separate full/production audits at the existing low threshold, types/build/tests, independent review, authorized branch push and ordinary PR integration with exact remote readback. Preserve all 42 original ledger rows plus INV01, including A17. Technical CI does not prove hosted or human acceptance.

## Reproduction and diagnosis

Fresh b355caf installation used Node 22.23.2/npm 10.9.8 and Windows `npm ci`, the existing hosted Windows workflow's lock-enforcing equivalent. Lock SHA-256 remained `43155d8e1650cf89ded732133384173b260becea9b8b1edcdcfbc02ed628f729`. Full audit exited 1 with five affected packages (one high, four moderate); production-only audit exited 0. This is not proof of production exposure. The first PowerShell launcher treated an npm deprecation warning on stderr as a terminating shell error; no terminal npm result was claimed. Its retry captures child streams directly and completed installation. Retain both attempt records.

Actual installed paths: webpack/schema-utils → ajv → fast-uri 3.1.6; Cloudflare vite-plugin/Wrangler → Miniflare 5.20260911.0-alpha → undici 7.29.0. The audit's proposed tooling downgrade is unnecessary to address the vulnerable leaves and would broaden the change.

The chosen existing fast-uri override becomes 3.1.8, covering the 3.1.7 authority/bracket fixes and the later 3.1.8 host-case correction. Miniflare receives a narrowly scoped undici 7.29.1 override. Both stay on their existing major/minor lines; undici requires Node >=20.18.1, compatible with pinned 22.23.2. Keep Cloudflare, Vite and application dependencies unchanged. Regenerate the lock with pinned npm; inspect the actual package diff before accepting it.

Primary sources inspected: [authority injection](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3), [bracket host confusion](https://github.com/fastify/fast-uri/security/advisories/GHSA-58mr-gqgx-xq4g), [host-case correction](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj), [undici decompression error](https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v), and exact npm registry version/integrity/engine metadata. No audit threshold, assertion or baseline is changed.

## Verification and review status

The bounded dependency correction and local verification are complete, as recorded below. Assigned Claude review, remote synchronization, PR/main inclusion and applicable candidate-source hosted results remain pending. No integrated slice completion or production GO is claimed. The earlier efadf24 full aggregate and base-source iOS/PDF observations remain source-qualified history; see [PRIOR_HOSTED_EVIDENCE.md](PRIOR_HOSTED_EVIDENCE.md).

## Resumption checkpoint

The next session resumed this existing isolated checkout without changing ownership or scope. Remote readback still identified main as `b355caf36fbb27c31a338520fdfeef9649afadc3`; the task branch and PR were not yet present remotely. The original root workspace's two unrelated edits remain preserved. No prior install-after result was inferred from its incomplete log, and process inspection confirmed no matching installer remained before restarting verification.

[Supplemental Codex review](SUPPLEMENTAL_CODEX_REVIEW.md) found no blocking source issue and confirmed the restored 27 optional-package classification flags. The assigned Claude review remains pending; no Claude tool or executable is available in this session. This supplemental review is not a reassignment or claim of Claude approval.

The separate verification-only launcher initially failed before installation because its null-delimited Git file list retained an empty trailing item. Filtering that terminator corrected the launcher; no product input changed. This preparation failure is separate from dependency installation or application test results. The retry uses pinned Node 22.23.2/npm 10.9.8 and records every terminal stage, initial/final tracked-file hashes, manifest/lock identity and unchanged PDF baseline.

While the full web check was running, the user supplied a separate tax-calculation handoff for local root commit `3db5edcb9308d4c20fb600fead61013a85eb0576`. It explicitly prohibits push, merge and deployment without approval. The coordinator therefore keeps this CI slice local as well; no remote publication is attempted from this session. The running local verification continues without changes to either product's source. Tax-package results and independent findings are separate evidence and do not validate the dependency candidate or vice versa.

## Completed local verification

The [terminal receipt](evidence/result.json) records 09:32:12Z–09:55:35Z on 29 September 2026, against base `b355caf36fbb27c31a338520fdfeef9649afadc3` plus exactly the two pending manifest/lock changes. These are working-input results, not a claim that a future commit or hosted build has been exercised. Manifest SHA-256 is `4043337fd6243ee966d8178f2ef3421ee80c1e7a8cc50d1e9ee751f6b2568ec8`; lock SHA-256 is `cde027aba739555279fe0a32f16748e5ee9b7ffa98209002ad832b0fe05d5a2c`.

| Check | Result |
|---|---|
| Fresh Windows `npm ci`, pinned Node 22.23.2/npm 10.9.8 | PASS, 527 packages installed; lock unchanged |
| Full `npm audit --audit-level=low` | PASS, zero vulnerabilities |
| Production `npm audit --omit=dev --audit-level=low` | PASS, zero vulnerabilities |
| Actual dependency graph | PASS: fast-uri 3.1.8; Miniflare resolves overridden undici 7.29.1 |
| Historical migration input preflight | PASS, both exact historical objects available |
| Strict nonincremental TypeScript | PASS |
| Repository lint | PASS, zero errors; three existing unused-variable warnings in unchanged files |
| `npm test`, including verified production build | PASS: 987 tests passed, zero failed, three existing opt-in skips; 990 total |
| Build's migration assertions and parity lock | PASS: two migration checks; 18 deterministic routes |
| Final tracked-byte guard | PASS, no tracked file changed during verification; PDF baseline unchanged |

The three lint warnings are in the existing viewer-suspension evidence script, `tests/dossier-persistence.test.ts`, and `vite.config.ts`; none of those paths changed. Existing deprecation/chunk-size/build-plugin warnings remain visible in the logs. No threshold, assertion, golden, timeout or native source was altered. The complete [web log](evidence/web-tests.log) preserves all output, and the [before audit](evidence/audit-full-before.json) preserves the original failure. The full release aggregate and PDF corpus were not rerun locally for this patch; candidate-source hosted/native/PDF checks remain pending.

The staging whitespace check reported only raw command-output formatting: trailing spaces in the generated build route table and blank final lines in npm logs. Those original logs are intentionally preserved. Source, Markdown and JSON pass the separate whitespace check; no source warning is waived. A focused outgoing-content scan found no high-confidence private-key, GitHub-token, live API-key, authorization-header or cookie-header markers in the named files; this is a bounded scan, not a security certification.

## Local delivery boundary

This source and evidence are a local development checkpoint on `codex/ci-stabilization-2026-09-29`. The final source diff contains only `package.json`, `package-lock.json`, and this task's named review/evidence directory. No task branch or PR is published and no main integration is claimed. The assigned Claude review is still pending under `CODEX_NEXT_STEPS.md`; supplemental Codex review is explicitly identified rather than substituted silently. Original 42-row runbook coverage, INV01, A17 and release/pilot gates are unchanged.

The root checkout remains at the user's tax commit with only its pre-existing `Cargo.toml` formatting change; that file is not part of this checkpoint. The next implementation choice is awaiting clarification between tax corrections, CI continuation and tax integration planning. No independent next slice is started in this checkpoint.
