# CV-034 — AI generation authentication identifier

## 18 November 2026: signed-in v222 audit and repair

Scope: continue CV-012 with the owner's authorized synthetic source, version 2 of `Synthetic release 209 original`, in the synthetic release-audit case. The user authorized bounded provider submission and suitable labelled QA review decisions. No real client material or new portal grants were used.

The live generation request returned HTTP 503 at 11:04:07 UTC. Worker request `cea5bfc14a9f79a5d84061037e104b30` completed without an uncaught exception. Read-only D1 inspection found one failed job, `proposal_job_182d842fe13e4228ac32b62ad1cd6b69`, attempt 1, `provider_unavailable / provider_configuration_unavailable`, and no provider receipt. No candidates or authoritative records were created. The stored production API credential was present as a redacted secret; no credential was read in plaintext or changed.

Root cause: `local-auth.authSubjectHashes` returns unpadded Base64URL HMAC-SHA-256 pseudonyms. The generation route passes that identifier unchanged, while the provider boundary previously accepted only `sha256-` plus 64 hexadecimal characters. The request was rejected locally before provider transmission.

The repair accepts the canonical 43-character Base64URL encoding of a 32-byte HMAC, retaining the existing hexadecimal format for compatibility. It keeps the exact pseudonym used for rate limiting and audit; no raw email is transmitted. Malformed, padded and noncanonical identifiers still fail before fetch. No source selection, access, review, retry, model, credential, or retention policy changed.

Validation: 20 scoped tests pass, covering an actual synthetic HMAC passed unchanged through the provider adapter, malformed identifier rejection without transmission, provider contract, D1/R2 commits, bounded retries, exact-source review, stale-source handling and rejection history. Local sandbox execution failed before tests because `uv_os_get_passwd` returned ENOMEM; the authorized unsandboxed run passed. Release and signed-in post-fix generation/review remain pending.

## Related audit findings and next steps

- CV-035: in Russian, the Evidence heading switches but generation controls, disclosure, manual evidence forms, proposal queue and failure notice stay English. The same failed state and selected version survived EN/RU switching without rerunning generation. [Live Russian screenshot](receipts/cv034-ai-review/v222-ru-before.jpg). This is an open localization issue, not accepted bilingual completion.
- CV-012: after releasing CV-034, explicitly retry the same failed synthetic job, inspect exact source spans, record only suitable labelled QA decisions, and verify reload/history in EN/RU. Zero grounded candidates is a valid result, but cannot substantiate review/apply acceptance.
- CV-032: PR #317's iOS simulator launch timed out at 120 seconds before application execution. The duplicate push workflow passed; the failed PR job was rerun. At audit time the rerun remained in progress. GitHub reported #317 merged at 11:00:51 UTC as `1464c7293c7ab59f13394e34f2131213628ef204`; this audit does not claim all checks were green at that merge.
- CV-010, CV-028 and CV-029 remain pending an active test client. No invitations were created.

Source ownership: clean isolated checkout at canonical main `1464c7293c7ab59f13394e34f2131213628ef204`, branch `codex/cv012-ai-review`. Only the provider boundary, its regression test and iteration evidence are in this repair slice.
