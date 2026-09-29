# Matter read-fence independent review

2026-09-27. Scope: ignored source proposal `matter-read-fence/proposal.patch`, SHA-256 `4c044bc5548945a9ee639d750c1452e0a41475cc79f02434afd14ec80191d5bf`, its 19-file `after/` mirror, and proposed maintained synthetic regression. This reviewer did not author the implementation and did not apply or execute it during this proposal review.

**Source proposal: no substantive findings; cleared for application within the already authorized work.** Application and post-application test/source identity checks remain separate below. This closes neither the unrelated source-version browser journey nor hosted/human/accessibility acceptance.

## Reviewed behavior

- The shared helper resolves the live request identity with `identityOnly: true`, compares current user ID, immutable actor ID and normalized email, then revalidates access against the original organization-bound context. It does not refresh organization selection or provision a replacement organization. Current exact participant identity and role must match the captured permission projection. Loss, unavailable identity or changed authority returns a private denial without the prepared payload.
- All 13 per-Matter JSON GET handlers have their successful data response fenced after payload reads. Both detail PUT readbacks are also fenced; the latter adds delivery authorization and does not retry or roll back a previously committed write. There are 20 wrapped success returns, including five notes variants and both disposition variants. The helper returns the original successful `Response`, preserving status, headers and bytes, and cancels its body on denial.
- Four document/output/manifest/presentation routes use the stronger identity-plus-original-access check at their existing delivery boundaries (five guard calls, because presentation checks after source read and after rendering). Existing body cancellation remains. There is no new public download URL or authorization shortcut.
- The collection captures participant ID only internally, reads owner names, rechecks live identity and original organization, then performs one bounded final grant lookup for at most 51 rows including pagination lookahead. Exact actor/user, organization, active participation, participant ID and role are checked. A mismatch returns no summary items or cursor; unchanged successful wire content is preserved. Empty collections still recheck identity and organization.
- Generic errors with no private response payload remain unchanged. The static initial inventory's assertions line 131 was a generic source-limit 409, not a second success path; only the actual success at original line 142 needs the wrapper.
- No renderer, persistent schema, source upload policy, source/version mutation or output-approval logic changes were included.

The sequential final checks address the identified post-payload scheduling window. They are not a cross-store serializable snapshot and cannot prevent an authority change after the final database check or introspect a trusted provider's logout after its request assertion has been accepted. Local authentication is rechecked through the existing uncached local-auth path. These limits are stated in the implementation and should remain in evidence claims.

## Regression review

The typed 15-case proposal (then SHA `b4b643ea9f29ed6f0dc2bb6627bb61c0fa6f1bff44ee7d434b05ef44f6d42850`) exercises actual selected handlers and production context/organization/access/policy functions. Database query execution, identity and unrelated readiness are explicit in-process test doubles; SQL parameter checks constrain important actor/organization selections. Cases cover baseline and unchanged-barrier success, membership loss, identity disappearance/switch, role downgrade and fresh viewer permissions, collection removal/role/lookahead/empty-identity branches, and preserved versus denied 201 note-operation recovery. There is no ordinary-password/session-store/database/browser/network claim.

Two narrow maintained-test requirements were sent to the test author before application:

1. Create the receipt output directory recursively so a fresh checkout does not fail in the after-hook with ENOENT.
2. Add suspended-then-resumed membership revision drift: the paused request retains its old captured authority and must deny, while a newly resolved request succeeds. Inactive membership tests alone would not catch an implementation that silently refreshed the organization context.

The author separately identified and is correcting default receipt labeling/path so current-source runs cannot overwrite the archived red baseline. Preserve the red script, receipt and log byte-for-byte. These test-maintenance changes do not require a source-proposal change.

The supplied compiler overlay receipt reports 433 roots, 20 overrides and zero diagnostics for the source patch plus the earlier typed test. It is an overlay check, not a post-application result. This reviewer read its receipt and reviewed the test code; execution was by the other agents.

## Post-application review — PASS in the stated scope

The implementation agent applied the 19-file source proposal at `21:39:29Z`, after the immutable baseline guard completed. This reviewer independently hashed all 19 current files against `proposal.receipt.json`: **19/19 exact matches**, no additional source drift. The patch digest remains `4c044bc5548945a9ee639d750c1452e0a41475cc79f02434afd14ec80191d5bf`. Inspection of the actual Git diff confirms the same 133 additions/40 removals across those 19 files, with 20 JSON success wrappers, five delivery checks across four routes, and the bounded collection check including its pagination lookahead.

The final maintained `tests/dossier-read-access.test.ts` SHA-256 is **33ad605555018437b8fcb76025c5614947c7bb7539a367bba96992a59c4031f4**, equal to its ignored proposed source. Both review requests were addressed: its after-hook creates the receipt directory recursively and restores `fetch` in `finally`; two new tests reject the old in-flight request when membership is active again at revision 3, while a fresh request succeeds. Current runs are labeled `CURRENT_SOURCE` and write `current.receipt.json`, preserving the separate archived red baseline.

Read-back of the actual execution receipt and TAP confirms **17/17 PASS, 0 skipped/failures**, exit 0, pinned Node `v22.23.2`, `21:40:07.8194710Z`–`21:40:11.8844956Z`, command `node --import tsx --test tests/dossier-read-access.test.ts`. This reviewer independently compared all **12 loaded production-source hashes** in `matter-read-race.current.receipt.json` with current files: all match; all loaded paths are actual source paths, with no overlay. The resumed-membership observation is 404 with no assertion/excerpt/captured write permission; the fresh request is 200. Unchanged detail/collection/note recovery controls pass.

The separate `matter-read-fence/actual-route-contracts-host.log` contains **49/49 PASS, 0 skips/failures**. Its earlier sibling `actual-route-contracts.log` records the retained `tsx` bootstrap `uv_os_get_passwd`/ENOMEM environment failure before those tests; that attempt is not recast as an application assertion result. The 49-case suite is route/source-contract coverage, not 49 ordinary-auth browser scenarios.

**The identified P1 is corrected in the applied source and the independently reviewed deterministic regression scope. No remaining substantive finding in this patch was found.** The unit identity stub does not exercise the real local token/session store. The source calls the existing uncached local-auth implementation, but real token-store integration, provider-side logout behavior, browser/hosted delivery and complete source-version/report acceptance are not proven by these 17 tests. Actual typecheck/lint and broader route/real-store checks were still delegated/in progress when this review was finalized; their results must be recorded separately.

The existing full baseline aggregate passed against pre-fix `6ab091d`; it cannot certify this changed candidate. The root will bind the new source checkpoint/build and run the next required aggregate. No release-gate or publication claim follows from this scoped correction.

## Final maintained-test lint correction — independently reviewed

The first actual changed-file lint run identified `@next/next/no-assign-module-variable` in the test loader. The test author renamed the local `module` binding to `compiledModule`. This reviewer compared the preserved source in `matter-read-race-prelint/dossier-read-access.test.ts.source.txt` with the current maintained test: **only that binding and its references changed**, with no fixture, assertion, loader behavior or application change. The preserved test hash is the earlier `33ad605...` reported above, and the earlier 17-case source/log/receipt remain in `matter-read-race-prelint/`.

The final maintained test SHA-256 is **066b96e4cd96786c1cc97a7666453bd9f74a5f6a7817cecf7fa50f3309946c8a**. The actual rerun receipt records pinned Node `v22.23.2`, exit 0, `21:44:13.1475184Z`–`21:44:17.2014979Z`, and the same maintained-test command. The independently read TAP is **17/17 PASS, 0 skipped/failures**. Its raw stdout hash `d4d7b9281a96e934d203d10ecae6c463473435d260d0e83f9ec90918694802c0` and current-source receipt hash `e27f5cfb0df975ed6b610114b711934aa337def7abc814c8f68e371b53e4fcdf` independently match the execution receipt. All 19 application source hashes were rechecked and still match the approved patch.

The root reports final changed-file ESLint exit 0 with no warnings/errors, and `matter-read-fence/actual-lint-final.log` is empty as expected. Retain the earlier lint failure log. This scoped lint result does not change the **three warnings in the historical full baseline aggregate**. The final typecheck rerun was still pending its completion receipt when this addendum was written; an empty in-progress log alone is not a PASS. The scoped source/P1 conclusion above is unchanged.
