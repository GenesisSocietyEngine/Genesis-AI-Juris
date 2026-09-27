# Private Matter responses after an access change

27 September 2026 UTC. Intended outcome: a slow private read must recheck the request's live identity and original organization/participant authority before returning its prepared response. A user whose identity, membership or role changed must not receive the previously prepared private content or stale permission projection. An unchanged authorized request must keep the existing response content, status and headers.

## Finding, implementation and acceptance

The [independent lifecycle audit](AMENDMENT_SOURCE_LIFECYCLE_REVIEW.md) identified a P1 gap after initial authorization. The original synthetic detail-handler regression demonstrated a pending response returning status200, an assertion/source excerpt and the old write permission after membership suspension; a newly started request correctly returned404. This was a strictly in-process reproduction using synthetic identity/database/readiness doubles and the real route/context/organization/access/policy code. It was not an attack against hosted data or an ordinary-password/browser check.

The correction changes [the shared server boundary](../../../app/dossier-server.ts) and 18 Matter route files:

- Re-resolve identity without choosing or provisioning an organization. Compare immutable actor ID, user ID and normalized email to the captured request identity.
- Revalidate against the **original** organization context and current exact participant/action. Do not refresh the captured organization revision after suspension/resumption. A changed participant ID or role requires refresh, without returning the prepared payload.
- Fence 20 JSON success returns across 13 per-Matter GET handlers and both detail PUT readbacks, including note operation receipts, history/backlinks and disposition branches. Cancel a prepared response body on denial; otherwise return the same `Response`.
- Strengthen five delivery checks in four document/output/manifest/presentation routes, preserving their existing body cancellation and private storage boundaries.
- Recheck collection identity and organization, then compare exact current participant grants in one bounded query for up to51 fetched rows, including pagination lookahead. Participant ID remains internal; the successful wire schema is unchanged.

This is a delivery check, not a retry or rollback of an already committed mutation. It introduces no migration, source/version mutation, report renderer change, new download URL, approval inheritance or authorization exception. Source upload policy and all three PDF formats/tree options remain intact.

The application patch contains 19 files and matches reviewed proposal SHA256 `4c044bc5548945a9ee639d750c1452e0a41475cc79f02434afd14ec80191d5bf`. It was applied after the baseline aggregate's final immutable-source guard, at21:39:29UTC. It was not part of the passing `6ab091d` baseline gate.

## Targeted verification checkpoint

The maintained [regression suite](../../../tests/dossier-read-access.test.ts) passes **17/17 on actual source**, no skips, after the test-only lint correction at21:44:17UTC. Cases cover detail identity/membership/role changes; suspended-then-resumed revision drift and a successful fresh request; unchanged and changed collection grants including lookahead; empty-collection identity loss; and preserved201 versus denied note-operation recovery. Successful controls prevent blanket denial from appearing correct. Barriers have timeouts, receipt directories are created for fresh checkouts, and the fetch guard is restored.

Final test SHA256 is `066b96e4cd96786c1cc97a7666453bd9f74a5f6a7817cecf7fa50f3309946c8a`. The earlier17-pass test used a local binding named `module`, rejected by the Next lint rule. Only that binding was renamed; earlier test/source/receipt evidence was retained separately. The first sandbox TSX bootstrap failures occurred before assertions and were retried on the host with the same pinned toolchain; they are harness failures, not failed authorization fixes.

The 49 existing route/source-contract checks also passed. Final nonincremental TypeScript passes with zero diagnostics, and focused lint on the20 changed source/test files passes with zero warnings/errors. The broader existing handler/auth/organization selection passes26/26, exit0, in261999.684ms. That selection explicitly excludes one long Canopy parent and its six nested scenarios; those are NOT_RUN in the selection even though Node reports skipped0. The unchanged full aggregate will execute them. A new exact-source aggregate is required separately. The full baseline's three lint warnings remain distinct from this focused lint result.

Independent source review and actual-file hash readback found no remaining substantive finding in this patch. This closes the identified P1 within the stated source and deterministic regression scope. It does not close every acceptance scenario or establish release readiness.

Evidence: [independent review](AMENDMENT_PRIVATE_READ_REVIEW.md), [actual regression execution](evidence/amendment-private-read/actual/matter-read-race.actual.execution.json), [actual TAP](evidence/amendment-private-read/actual/matter-read-race.actual.tap.log), [loaded source hashes](evidence/amendment-private-read/actual/matter-read-race.current.receipt.json), [focused commands/results](evidence/amendment-private-read/verification/actual-verification.receipt.json), [filter and interruption scope](evidence/amendment-private-read/verification/FILTER_SCOPE.md), and [applied patch identity](evidence/amendment-private-read/patch/applied.receipt.json). The original [three-case failure](evidence/amendment-private-read/red-3case/matter-read-race.unit.tap.log), expanded [frozen-source failures](evidence/amendment-private-read/red-proposal-15case/matter-read-race.frozen.tap.log), and pre-lint evidence are preserved separately. The [baseline gate's independent review](AMENDMENT_AGGREGATE_BASELINE_CRITICAL_REVIEW.md) applies to6ab, before this patch.

## Limits and remaining journey

The identity test double verifies that the real response boundary rechecks identity; it does not exercise the real local token store. The implementation calls the existing uncached local-auth resolver, whose predicates retain expiry, revocation and account checks. The sequential final checks are not a cross-store serializable transaction and cannot prevent an authority change after the last database check. Trusted provider headers cannot introspect a later provider logout on an already accepted request.

Source-v2 browser upload remains blocked by the unresolved permission check. Actual updated-PDF/reviewer delivery, role UI, hosted candidate, actual200% zoom, real screen reader and human sessions remain separate. The logical document's carried `accepted_source` badge is not evidence of a fresh review of replacement-version bytes; the unclosed lifecycle acceptance must verify exact citation/assertion/output review rather than infer it from that badge.
