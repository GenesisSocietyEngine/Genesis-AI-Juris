# CI stabilization integration disposition — 29 September 2026

The user's current instruction is to proceed with amendments and prepare the new release. This supersedes the earlier local-only checkpoint for this scoped CI correction. Source synchronization and release acceptance remain distinct.

## Source and independent review

Reviewed candidate: `ae78241f043bf23b5cf654afda6260992e75813c`, parent current GitHub main `b355caf36fbb27c31a338520fdfeef9649afadc3`.
Only `package.json`, `package-lock.json` and fifteen named evidence files differ. Actual selected patches are fast-uri 3.1.8 and Miniflare-scoped undici 7.29.1; the earlier broader 5175cb0 patch is superseded.
Independent Codex source review confirmed the exact manifest/lock hashes, fresh installation, all eight recorded stage exits, 987 passing tests/three existing skips, zero full/production audit findings and the unchanged-input guard. This is review of recorded local execution, not a new rerun.
Independent publication review inspected all fourteen new reachable blobs (661,923 bytes), three reused audit blobs and commit metadata; no high-confidence credential/private-client indicators or unintended artifacts were found.

The coordinator explicitly assigns these independent Codex reviews to this bounded dependency slice. The separately named Claude review has not occurred and is not claimed. The historical record retains that distinction; it is not silently rewritten as Claude approval. Actual candidate-source hosted checks are required before ordinary integration acceptance.

## Preservation and verification boundary

Raw logs retain their original trailing spaces and final blank lines. Source, Markdown and JSON patch hygiene is checked separately; no verification policy is relaxed and no original evidence bytes are rewritten.
Original worktrees, the root tax branch, its pre-existing Cargo.toml edit, and untracked canonical support artifacts are preserved. This slice does not include the separate organization follow-up or unintegrated tax crate.
A later documentation-only commit containing this disposition changes no verified application, workflow, package, baseline or test inputs. Hosted CI must identify its own exact checked-out SHA; earlier b355caf PDF/iOS results do not certify that later SHA.

## Release boundary and next step

Publish the reviewed task branch, verify its remote SHA, open the normal PR, and retain actual hosted results. Merge only through existing repository controls when the applicable checks/review permit it. The PR merge record and current remote main are the final synchronization evidence.
The complete final-source release aggregate, hosted auth/invitation/save/source/report journeys, actual accessibility and five new-user acceptance, physical backup/restore, and named rollout operator remain governed by the existing runbook. This patch does not turn those open gates green.
No production deployment, migration, live mail, audience change or external pilot is performed by this source-integration step.
