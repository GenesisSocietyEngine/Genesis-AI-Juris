# INV01 P1 amendment release record

This record supersedes current-candidate claims in the historical R decision. Scope remains the original 42 UX requirements plus INV01. No functionality expansion, external pilot, publication or production migration has occurred in this execution. Existing publication authorization is retained, conditional on every mandatory gate passing.

## Source and artifact

- Isolated implementation branch: `codex/inv01-p1-amendment-2026-09-29`.
- Application/test correction: `55990ba92e6e78406a6af9fd67add5db8b9b1af9`; separate CI/migration correction: `c079e14`. Parent: `f880bcaf961066db2e776e32e3bfbb89e19e001d`. First frozen aggregate source: `a9d8c767b67d1485b2f9e6bf0e07dcd324b18f38`. The subsequent baseline/evidence follow-up requires its own recorded immutable retest source.
- Application input digest: `5cde43f86ee22fce243cf1976fa1d9bda7fc1235c4561deed6980e1dc2b4fb66` (395 inputs); hosting configuration SHA-256: `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`.
- Migration set: ordered 0000-0023, including two invitation tables; exact SQL/journal hashes in `source-identity.json`. No new migration beyond inherited corrected 0023.
- No deployment artifact is certified yet. The first build has 410 files, manifest digest `5796f06875b3f575f4552ba2809342849accedf8c650b218af15826c0fc51ae4`; `aggregate/artifact-identity.json` explicitly records that the final-build stage was not reached. `pdfs/inspection.json` binds seven local regression artifacts to their SHA-256, production receipt fingerprints and Poppler runtime. These are not delivery receipts.
- Canonical `inv01-2026-09-28` remains f880bca with its two preserved dirty files and review/support artifacts, rechecked after 05:25Z. External session `01a0e62e-6c40-73c1-b1bf-dc90d4d09975` recorded task completion at 04:51:35Z; its prior PID and a matching Codex process were absent at the later check. Canonical integration and consolidation with that session's separate candidate remain pending. This execution is sole writer only to the isolated amendment checkout. No launcher draft or incomplete mailbox support was integrated.

## Gate decisions

| Gate | Result and exact limit |
|---|---|
| P1-1 source/targeted/visual | PASS locally on committed correction: 29 tests; supported LF/CRLF/CR preserve every line; Full renderer 5 retires old Full receipts; independent source and 12-page FiveFlats review plus coordinator boundary review found no material issue. See REVIEW.md. |
| P1-2 workflow/preflight | PASS local implementation/review: fetch-depth 0, exact ref/pinned action/security retained, useful missing-history and Git-access diagnostics. |
| P1-2 fresh local checkout | PASS at 55990ba: separate `file://` transport clones, exact detached SHA; depth-1 preflight rejects both SHAs, full-history migration/history suite 5 PASS, 0 FAIL/SKIP. See `fresh-full-history.log` and `fresh-shallow-history.log`. Existing pinned dependencies reused via junction; this is not a clean npm-install or hosted-run claim. |
| P1-2 remote/hosted | BLOCKED: read-only lookup in `GenesisSocietyEngine/Genesis-AI-Juris` returned 422 for both exact SHAs; this does not attest the separate Sites private source repository. Canonical has no remote. Both commits are ancestors of the frozen local bundle, but availability from the actual CI remote and an amended-source hosted CI run remain unverified. |
| Populated upgrade/recovery | PASS isolated 0022-to-0023 rehearsal and old-source compatibility, pending-proof preservation, forward restoration/expiry and concurrent acceptance. NOT_RUN in hosted/production. |
| Strict types and workflow syntax | PASS: nonincremental TypeScript exit 0; YAML/ref/security assertions pass. |
| Complete release script, first attempt | FAIL at PDF visual comparison on a9d8c76, exit 1, 03:41:11Z-04:44:01Z. Exact source receipts match. Web 1-5 PASS: strict types, lint (0 errors/3 warnings), 968 tests PASS/3 existing C1-v91 opt-in SKIP, and separate dossier 5 PASS. Web 7 onward, mobile/native and script-final guards NOT_RUN. The outer final source guard PASS is separate. See `aggregate/result.json`; overlapping counts are not added. |
| PDF baseline reconciliation | Reviewed inherited 2116 disclosure reflow: five of 55 expected image hashes changed; 47 PDFs/760 pages generated. Official update exit 0 exactly matches the reviewed candidate. This mutation is not a read-only PDF gate PASS; committed-source retest remains pending. See BASELINE_REVIEW.md. |
| Native prerequisite | Initial PSSecurityException preserved in `native-prerequisite.json`. After the user's continuation instruction, the exact reviewed launcher ran with process-scoped RemoteSigned; no permanent policy change. Fresh private AVD started at 05:24:29Z; `native-ready.json` records device state, boot completion and exact P1GatePixel identity at 05:29:07Z. Native test execution is still NOT_RUN. |
| Canonical integration | BLOCKED pending controlled integration of the reviewed branch with preserved canonical edits and the other completed session's separate work; no reset, clean or overwrite. |
| Isolated hosted ordinary authentication | BLOCKED: distinct candidate target with verified physical independent D1/R2 identities and intended audience has not been supplied. |
| Invitation end-to-end/provider | BLOCKED: authorized sender configuration, recipients, provider delivery, ordinary signup/login and positive browser mailbox-proof acceptance remain unproven. Synthetic mail is not provider evidence. |
| Local invitation browser diagnostic | BLOCKED by Chrome's untrusted local HTTPS certificate. The server was reachable, but the user's manual Proceed attempt did not make the app attachable. No warning bypass was automated. Three isolated mailbox-helper tests PASS; they do not establish browser acceptance, provider delivery or new-user enrollment. |
| Source change to updated output | BLOCKED: original source-v2 chooser restriction remains; no alternative upload path used. Real reassessment/review/output and fresh receipt must be completed through permitted workflow. |
| Save/reopen, access loss/recovery, report delivery | PARTIAL historical local evidence; final-candidate hosted journey and relevant recovery matrix NOT_RUN. A separately observed organization-context issue is under another coordinator's correction, not imported here. |
| Accessibility | NOT_RUN for required actual screen-reader, 200% zoom and remaining complete keyboard/focus journeys on final source. Existing component evidence does not replace these. |
| Operations | BLOCKED: no named accountable rollout/rollback operator or hosted recovery/smoke evidence. |

The [original 42-row ledger](../ux-convergence-2026-09-27/POST_RECONCILIATION_CLOSURE.md) and [INV01 remaining gates](../inv01-2026-09-28/REMAINING_GATES.md) retain their dated evidence and limitations. No row is silently dropped or promoted to complete. Invitation-provider, source-v2, access/recovery, actual output delivery and accessibility gaps remain applicable to the full release. A narrower security release would need an explicit scope decision and its own exact diff and gates; none is substituted here.

## Rollout and recovery preparation

Follow [MIGRATION_RECOVERY.md](MIGRATION_RECOVERY.md) only after establishing the provider's actual backup/restore procedure, permissions and migration-versus-activation ordering. Those operational prerequisites remain unresolved; the documented logical sequence is not yet an executable hosted runbook. Code rollback leaves database changes intact. Never drop populated invitation tables. Prefer a reviewed compatible forward fix retaining the private-read patch; v102/bf579938 retains the known authorization defect and is not a clean security rollback.

Required configuration names (no secret values): `GENESIS_INVITATION_MAIL_ENABLED`, `RESEND_API_KEY`, `GENESIS_INVITATION_FROM_EMAIL`, `GENESIS_PUBLIC_ORIGIN`; preserve existing ordinary authentication and binding names `DB` and `DOSSIER_DOCUMENTS`. Mail remains disabled until sender and recipient authority are established. Binding aliases do not establish physical storage identity or isolation.

Read-only Sites metadata at 03:53:09Z still reported public v102, source `bf5799383a52b6617cd9d4a0acf47af780086218`, successful deployment `appgdep_6ab6ed70ee488191ba95f30293b6e6a1`, environment revision 39, and no preview target. See `production-readback.json`. This is hosting metadata, not live binary attestation or a post-release smoke result. No publication, migration, access change or live mail operation was performed here.

Rollout/rollback operator: **UNASSIGNED - mandatory blocker**, not inferred from the account name. Once all gates pass, recheck actual production version/audience/schema/storage, publish the exact verified source with Sites, confirm live source identity, and run authorized synthetic authentication, organization/role isolation, Save/reopen, report preview/download, receipt freshness, CR-boundary, invitation and logout smoke. Monitor failed saves, auth denials, report errors and invitation outcomes without sensitive content. Critical regressions trigger the reviewed forward-fix or explicitly authorized bounded restriction, preserving data. All post-release smoke is currently NOT_RUN.

## Separate verdicts

- Engineering: **BLOCKED** for the full amended release; two reviewed local corrections do not establish remote CI, aggregate or product acceptance.
- Production: **BLOCKED / NOT PUBLISHED**. No mandatory FAIL, BLOCKED or NOT_RUN can be waived by this record.
- External pilot: **NO-GO / NOT STARTED**. No separately evidenced GO or human-session completion.
