# Release A — frozen scope and recovery review

The product-owner amendment in `production-release-amendment-2026-09-15.md` replaces the previous universal browser publication hold. Release A is a bounded reliability publication. Release B and C still require the actual browser/human acceptance specified for their new visible workflows.

## Reconciled baseline

- Existing public Site: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6`; audience unchanged.
- Native metadata and successful deployment status confirm v86, source `dca6af234ce27c76a6b1cb22359be9540d8e5049`.
- Recovery version: `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_56f9e3f806008191823f659b14e76b57`.
- Prior successful deployment: `appgdep_6aa9218fecd481919a308810129fb433`, runtime environment revision39.
- Existing custom domain `studio.falcon-merlin.com`: active association and SSL according to native metadata.
- Fetched configured remote `main`: exact v86 source; no subsequent production code to merge.
- Phase2 source `9236c02a294c4c9a43cd49cb3113fba06a889c6b`, followed by report-only `645dee3`. Preserved on `codex/next-stage-review-2026-09-15`.
- Release source derived on `codex/release-a-2026-09-15`; final SHA is recorded in the publication report.

## Included and excluded

| Scope | Release A treatment |
|---|---|
| Requests | Durable actor/key/payload-bound receipts, original operation GET, exact request GET; unkeyed legacy clients remain supported. |
| Dispositions | Original operation lookup and exact actor/key binding; original receipt revision, citation acceptance history and historical deadline context retained. |
| Activity and assertions | Authorized exact-record GET selectors; ordinary pagination retained. |
| Working notes | Authorized persistent backend, immutable revisions, exact source links/backlinks/unlink; no editor entry exposed. |
| Canonical queue/recovery models | Retained foundations; not connected to the Action Center. |
| Existing interface | `MattersClient.tsx` and `DispositionReview.tsx` restored together to v86. One text-only correction says “Review outcome saved.” without prematurely claiming refreshed readiness. |
| Receipt panel/new recovery form | Retained candidate work, excluded from rendered production integration. Unreferenced helper files do not expose controls. |

The restored request interface ignores mutation payloads and reloads the current case. Removal of post-write readiness calculation is compatible. It has no network-error replay control: its stale-revision retry is a read. Do not claim legacy request forms have acquired durable recovery from these server changes.

## Migration and recovery

`0022_loving_juggernaut.sql` is unchanged from the tested Phase2 candidate: SHA256 `2ebc937ea8ab24670754d13247aaf4251ae941949bf99301c9f605a89808b111`. Baseline0000–0021 SQL and journal entries remain unchanged. It adds five tables and associated indexes/triggers, plus a source-anchor composite unique index containing the existing primary key. No existing column or existing-table trigger is altered; no backfill or destructive rewrite.

Before publication, supported live DB overview showed baseline disposition/citation tables and no request-operation table. The bounded overview does not expose a migration ledger; no ad hoc SQL was used. The supported Sites process applies and records pending migrations before Worker upload. Record terminal deployment and postdeployment schema evidence separately; do not infer completion merely from source filenames.

Focused isolated tests run the complete exact-v86 route dependency graph against the populated upgraded schema, with synthetic provider headers. Old code reads cases/documents/citations/requests/outputs, creates and receives a request, denies foreign-organization reads/downloads and viewer writes, seals a current snapshot, generates/reopens a PDF, and reopens the original PDF byte-for-byte. All five new tables remain identical; foreign-key check is clear. Evidence: `release-a-2026-09-15/rollback-evidence.json`.

Recovery target is the saved v86 artifact above. Reverting code leaves0022 and new records intact. v86 temporarily lacks note/recovery endpoints and rejects keyed request payloads: cached newer clients must retain unresolved operations and must not strip keys or re-key. Reload the restored interface for its supported legacy operations. Use the native deploy operation for that saved artifact if a severe regression is observed; do not run a destructive down migration. If a deployment is uncertain, reconcile its exact ID before another attempt.

## Review and actual evidence

1. Baseline/scope review: two independent read-only audits plus owner inspection; no unrelated source changes. Selected server scope and retained established UI.
2. Migration review: fresh full schema, populated upgrade, real API persistence/role/concurrency/receipt checks and exact-old-code compatibility: **15/15 passed** on the release source.
3. Model/source/React render checks: **39/39 passed**. These include unconnected models and are not end-to-end UI acceptance.
4. Release build and strict TypeScript passed; locked canonical mobile contract18 routes passed. Existing chunk-size warning retained. No full-suite claim.
5. Browser discovery finds Chrome, but tab refresh fails after20000ms using the supported controller. Recovery guidance checked; no alternate driver or live cloud-browser navigation used. No rendered candidate review, native-mobile observation or authentication-inclusive timing.
6. Production error-log sample (last180minutes) contained crawler `/robots.txt`404s only; it does not reproduce or disprove the owner's older PDF/sign-in report. PDF server generation succeeds in controlled fixtures. HTTPS provider sign-in remains dispatcher-owned; no substitute auth route is added.

## Release B entry findings

The preserved candidate form needs two corrections before it is reinstated: a403 during the second/original-operation GET must clear private record/draft/operation just as other denial branches do; a500 during the first record GET must not falsely say private data was cleared. Parent-owned recovery across section changes, canonical queue integration, exact targets, current queue after save, conflict comparison and real browser acceptance remain Release B work.

Release C remains a focused editor on the existing notes API, with exact D09v1 cold-chain/delivery and D08v2 staffing-source links, backlinks, safe unlink, history and persistent reopening. Do not begin another unreviewed visible stage while the preceding release's required interface acceptance is unavailable.

Full self-service readiness is not established by this publication. The release status must distinguish native publication from pending functional browser verification.
