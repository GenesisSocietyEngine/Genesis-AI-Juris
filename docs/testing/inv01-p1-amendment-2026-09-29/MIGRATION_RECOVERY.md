# Migration 0023 and recovery

This INV01 candidate adds `email_invitations` and `invitation_mailbox_proofs`. It inherits the corrected, unshipped 0023 from f880bca; this amendment does not introduce a further schema change. The older R release record's no-migration statement applies only to R.

## Isolated rehearsal

`migration-targeted-corrected.log` records 4 PASS, 0 FAIL, 0 SKIP. The test uses a populated 0022 database, ordinary local credential login/cookies and the exact bf579938 historical routes/transitive source. All six legacy table snapshots survive the additive upgrade. The retained e256660 migration reproduces its former unaccepted-proof deletion failure; current 0023 fixes only the temporary proof-user relationship with ON DELETE CASCADE. Accepted invitation identity/history remains protected. See `migration-compatibility.json` for historical source hashes. Synthetic captured transport is not provider-delivery evidence.

After 0023, old organization listing and member-role activity leave pending email invitations and mailbox proofs byte-for-byte unchanged. Old code has no email-invitation API: email acceptance pauses until compatible code returns. Restoring candidate handlers accepts an unexpired account-bound proof, retaining accepted history and exactly one membership and acceptance event. A deliberately expired proof fails; a new mailbox challenge then succeeds. Concurrent acceptance also yields one membership and event. Unaccepted-account deletion cascades its temporary proof while leaving the pending invitation; a recreated account cannot reuse the previous actor's proof. Accepted-account deletion through old routes refuses on its existing FK constraint, atomically retaining identity, proof, membership, invitation and an audit sentinel.

## Execution order before a permitted publication

1. The named operator must record the exact verified source/artifact, target audience, physical D1/R2 resource identities and schema/journal. Confirm independent candidate storage before hosted rehearsal. Preserve database and document-store recovery snapshots using the supported hosting workflow; do not export sensitive data into Git.
2. Verify the target is at the reviewed 0022 migration set. Compare the 0023 SQL/hash and expected additive schema with this candidate. An already-applied or divergent 0023 must stop this procedure for a separately reviewed additive repair; do not replay edited migration history or drop tables.
3. Apply ordered migrations through 0023 using the supported Sites migration/deployment sequence, then read back journal, both new tables, indexes, triggers, FK definitions and foreign-key check. Verify representative existing records using non-sensitive counts/identities. No production execution is recorded here.
4. Activate only the exact verified code and configuration. Keep mail disabled until sender configuration and authorized recipients are established. Verify ordinary authentication, organization isolation, Save/reopen, exports/receipt freshness and the invitation challenge/explicit-acceptance path in the authorized target.

## Recovery

Code rollback does not undo 0023. Never automatically drop either populated invitation table or delete retained history. The rehearsal supports old-code compatibility for the stated routes, not every deployed binary behavior. Pending invitations/proofs survive but their email flow is unavailable under old code; expiry continues. After a reviewed compatible forward fix is deployed, recipients repeat verification if their proof expired. Revoked/superseded/expired invitations remain subject to existing eligibility rules.

Prefer restoring a tested candidate descendant that retains the private-read authority fix and accepts the existing 0023 schema. Rehearse the exact replacement code against the populated schema before rollout. v102/bf579938 is only an attributed historical compatibility source: returning to it retains the known pre-patch private-read issue and is not a security recovery. If no verified forward fix is ready, the accountable operator must authorize a bounded access restriction through supported hosting controls while retaining data; no restriction is authorized or executed by this record.

Lost/incorrect saves, cross-organization access, missing PDF text, stale receipts accepted as current, or duplicate/unauthorized invitation membership are stop-and-recover triggers. Preserve non-sensitive error evidence and artifact identities. Recovery operator, hosted restore exercise and post-release smoke remain BLOCKED/NOT_RUN in the release record.
