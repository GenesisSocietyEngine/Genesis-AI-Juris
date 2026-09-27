# Local governed fixture C/D — ordinary HTTP preparation

27 September 2026. Environment: `http://localhost:5281`, isolated `.artifacts/ux-reconciliation-auth` database/storage. **Preparation and bounded actual HTTP checks PASS, completed18:15:47 UTC; browser journey remains separate.** This is separate from earlier in-memory fixture C helper checks and from hosted acceptance. The existing browser owner's Studio custom case1 was not modified by this fixture.

Acceptance established before execution:

- Sign in to pre-provisioned disposable local accounts with actual password POST and returned session cookies. No provider identity header, forged cookie, session seeding, auth bypass or weakened validation.
- Create a separate synthetic organization/Matter; establish real contributor/reviewer/viewer memberships through ordinary APIs. The foreign alias stays outside the organization. Any local invitation tokens remain in memory and are accepted only by the intended synthetic local actor; no external message/invitation is delivered.
- Upload a clearly synthetic text file through the document API and read back the exact authorized version bytes. Create exact extraction/version-bound anchors, record a synthetic reviewer acceptance, then a fact accepted by that reviewer plus pending assumption/contradiction assertions. Keep a missing-basis request open. Automated QA review records are not independent professional endorsement or output approval.
- Verify actual role readbacks, forbidden viewer mutation and foreign read/list/download isolation. Verify stale revision update returns Conflict without overwriting the winning current value.
- Prepare a second source file for the later browser version-change check without uploading it prematurely. Existing accepted citations must remain bound to v1 after that later operation; readiness/output consequences require their own observed evidence.
- Save only sanitized IDs, statuses, revisions, hashes and synthetic content in receipts. Never print or save passwords, cookies, bearer tokens or raw invitation tokens in review evidence.

Preparation script (ignored): `.artifacts/ux-reconciliation-auth/prepare-governed-fixture.mjs`. Credentials remain in the separately provisioned ignored file and are loaded internally. Script syntax check passed; `.artifacts` ignore coverage confirmed. It writes a sanitized resumable state receipt after each step and stops on unexpected responses; it does not silently count a rejected operation as PASS.

## Actual execution and browser handoff

Executed18:15:11–18:15:47 UTC on rebuilt local worker48515, Node22.23.2, after settings/handoff source changes. Root confirmed the active build digest at18:18:01 UTC as `7b1aacc7540a5738277f98f2d0c4b9d413999e4277cd497cc8421a3926b96b79` (380 source files; [source receipt](evidence/reconciliation-slice-source.json)); this is not the earlier849295 build. [Sanitized HTTP receipt](evidence/local-governed-fixture-cd.json) records all85 responses, exact IDs and final readbacks. No application or schema change was made for preparation.

- Organization: `org_15eba3abeeb241c6899481f557186dd4`.
- Matter: `dossier_4c45577c6bc54528b9330d018a893312`, final revision18, title **SYNTHETIC UX fixture C — evidence and review**.
- Document: `document_544afe4d7e6345d7a8bb82d3640f3db4`; immutable v1 `document_version_74cafe3815474c808a7adfea87340a1d`.
- Fact `assertion_58eb24a87dee4866a745f5cec428d5a7` is accepted with the synthetic reviewer's actor. Assumption `assertion_1dcba2f364e54b73b2928a9be1cf3809` and contradiction `assertion_8ba00fde69e1412a8ecca2e7fec689eb` remain needs_review with no reviewer. All3 exact anchors retain v1 and its strictUTF8 extraction bounds; each is separately accepted.
- Missing-basis request `request_1c2477b0c9ba424896cc88487c2ad4ea` remains open for the absent delivery-capacity document. No missing-source assertion was fabricated to bypass the real API's accepted-anchor prerequisite.
- Owner/contributor/reviewer/viewer readbacks returned their exact actual case roles,200. A viewer assertion mutation returned private404 and left revision18 unchanged. Foreign actor reads under both the target organization and its own organization returned404; its authorized list omitted this fixture. Foreign file download returned404.
- Contributor stale revision17 update returned409 `revision_conflict` after the owner's current update advanced to18; readback retained the winning `high` priority, not the stale `low` value.
- Viewer exact source download returned422bytes, SHA256 `f2d072fa17fd69a13399e0f4a3019a0eca55cfdbad53783cf48f862334f5a84e`, matching the uploaded synthetic bytes. This is actual file/API evidence, not an inferred browser download.

The first script attempt used the owner's actor-bound organization selection for the contributor. The server correctly rejected it with409 `organization_context_changed`; no upload occurred. The script was corrected to retrieve each actor's current selection through the ordinary organization API. The original failure is retained, followed by the successful resumed preparation; no production behavior or guard was changed. This was a harness error, not a hidden product fix.

Browser route (ordinary current actor resolves the raw organization ID): `/matters?organization=org_15eba3abeeb241c6899481f557186dd4&dossier=dossier_4c45577c6bc54528b9330d018a893312&section=evidence`. The browser reviewer received it. `.artifacts/ux-reconciliation-auth/fixture-c-source-v2.txt` is prepared for a later version-change observation; **it has not been uploaded by this preparation**. It changes the synthetic register from300 to320 while keeping the old v1 available.

Remaining **NOT_RUN in this receipt**: actual browser correction/source-version journey, governed output creation and dependency invalidation, real professional review, natural expiry, two-browser conflict UX and hosted acceptance. The HTTP conflict check is a real sequential stale-write test, not a two-window UI result. Initial local account provisioning remains separately disclosed; every organization membership, case participant, evidence object and review in this fixture was created by its ordinary API rather than seeded into the database.
