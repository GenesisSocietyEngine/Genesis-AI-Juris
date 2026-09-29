# Independent review of the corrected candidate's local API read smoke

Reviewed 27 September 2026, 22:03 UTC (28 September in Europe/Paris). **PASS within the recorded sequential ordinary-session scope; no substantive P0/P1 finding in this harness or its stated result.** This is a read-only review of the executed source, command wrapper, sanitized receipt, stdout/stderr and build identity. I did not execute a second smoke, issue HTTP requests, inspect credentials/cookies/database contents, start a worker or alter tracked files. The complete corrected-source aggregate is still running and remains a separate gate.

## Exact execution and provenance

- Candidate source: `e6c6adc6fe01129b2e3d442072c532e08591fae9`.
- Application input digest: `5597958a0a870757e75cfbdfba930007d475f782035db4ee8503a97aa1723afc`, 385 inputs. The source-bound build receipt checked at `2026-09-27T22:00:36.284Z` says `buildMatchesCurrentSource: true` and contains that digest in its built digest list.
- [Execution receipt](local-read-smoke-execution-2026-09-27T220210153Z/execution.json): pinned Node `v22.23.2`, exact argument vector for `http://localhost:5281`, the candidate build receipt, expected commit/digest and `--run-approved`; start `2026-09-27T22:02:10.153Z`, end `2026-09-27T22:02:18.733Z`, **exit 0**, no signal or spawn failure.
- [API receipt](local-read-smoke-runs/2026-09-27T220210764Z-e6c6adc6/receipt.json): start `22:02:10.764Z`, completion `22:02:18.632Z`, `PASS`, `interrupted: false`.
- Binding remains operator-confirmed built worker/port plus exact source-bound local receipt. It is not an independent HTTP attestation of the worker binary. Root reports the owned worker stopped after cleanup; I did not make an independent process-stop observation.

The independent byte hashes agree with the wrapper, build binding and stdout's receipt digest:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `local-read-smoke.mjs` | 17,457 | `4374127f667065141e1b77c902ab47f4910bff11ee2361ad740391e73a2a4ec5` |
| `run-approved-local-read-smoke.mjs` | 2,424 | `196b475abe5d486c401570c9368fbb06b92849d1d20a733598c2beecf80d86dc` |
| API receipt | 15,971 | `55dc56f124dc52ad567f0921c1d39a554dcf4c53b89665bc36683f2b6032aa44` |
| Execution receipt | 1,333 | `7da0a7286cb0b72fcf9d54ec4a23468a5b15bb338a69d1211b9c24924f4e342e` |
| Raw child stdout | 229 | `3d045c1e0123b09ced56c9b2531aae1a12469fe041fd5268a3f08fcbfd80c8ee` |
| Raw child stderr | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Candidate build identity | 570 | `8a481df14b07c8e5ccc14574edd3bde1b84af7d56ebe68432fb8c353cda241fc` |

## What the 39 response events establish

I independently parsed all 39 events: **20 HTTP 200, seven HTTP 404, 12 HTTP 401**, with zero unexpected statuses and `no-store` on all 39. There are nine named assertion groups, all PASS. The three cleanup results are separately counted; this is not 39 independent scenarios or 12 additional race tests.

| Observed scope | Result and actual assertion boundary |
| --- | --- |
| Three ordinary local logins | Owner, viewer and foreign accounts each returned `authenticated: true`, `authSource: local` and a server-issued session cookie. The exact script asserts all three before it treats login as successful. |
| Owner/viewer organization selection | Each fetched the current selection using the existing raw organization ID; actor identity, selected organization, active status and role were asserted. Viewer selection differs from the old stored selection; the old value was used only for comparison, never sent as authority. |
| Owner/viewer Matter reads | Collection, detail and document/version register returned the exact fixture and expected owner/viewer role projection. The permission object is compared exactly against the actual detail route contract. Both roles have `can_approve: false`; only owner has the other privileged flags checked here. |
| Exact source-v1 bytes | Both roles read 422 bytes with SHA-256 `f2d072fa17fd69a13399e0f4a3019a0eca55cfdbad53783cf48f862334f5a84e`, matching retained v1 and document-version metadata. This is not a source-v2 operation. |
| Foreign concealment | The target organization is absent/unselected. Four target-organization reads and three reads through the foreign actor's fresh personal selection return 404. The script constrains denial bodies to the error/code envelope and excludes the fixture marker; no private response body is written to evidence. |
| Preservation | The owner detail read model excluding volatile readiness, document metadata and organization member roster match their preceding canonical hashes. This is read-model preservation for the sampled structures, not all database rows, audit records or readiness equality. No application-content or membership mutation was requested. |
| Owned-session cleanup | All three ordinary logouts succeed on the first attempt. Reuse of each exact saved, server-returned cookie then yields 401 for collection, detail, document register and source download: **12 post-logout denials**. These observations exercise real local token-store integration, not an identity stub. |

The harness issues only the hard-coded GET operations and ordinary login/logout POSTs. It rejects redirects and non-loopback origins, gates execution on the explicit new build receipt/identity before reading its local credentials, and does not use provider identity headers, invented tokens, raw browser cookies or direct database operations. I checked the real login/logout/organization response contracts and detail permission projection against these assertions.

Receipt persistence is nonthrowing during cleanup; any write failure prevents PASS. Only cookies obtained by this invocation are eligible for logout. An ambiguous login with no returned cookie is recorded as unconfirmed, not silently treated as cleaned up. The failure and signal branches are statically reviewed; this successful execution did not inject those failures. A forced process termination could still prevent cleanup, as the plan discloses.

The inspected receipt and logs contain aliases, fixed status/error identifiers, lengths and hashes. They do not contain credentials, cookies, raw email addresses, raw API payloads or unredacted fixture identifiers. Login/logout payloads are not hashed into event records. Auth/session audit effects and ordinary server-side read maintenance are not asserted absent.

## Acceptance limits

This closes the bounded check that the corrected built candidate can serve authorized owner/viewer reads through ordinary local password sessions, conceal foreign contexts and reject those sessions after ordinary logout. The maintained synthetic regression separately controls the **mid-request** revocation schedule. This sequential run does not prove an in-flight real-session revocation race, a naturally elapsed TTL, provider logout, contributor/reviewer browser behavior, every changed GET/byte route, hosted delivery, source-v2 reassessment, governed output invalidation/approval, accessibility or human comprehension.

There is no second runtime execution in this independent review. The sanitized record deliberately omits raw response bodies; exact body/role/preservation conclusions rest on the inspected executed assertions plus their PASS receipt and response digests. The full release gate, integrated/browser acceptance, production release and pilot decision retain their separate pending/blocked status.
