# CV-009 · EU portal uploads · 17 November 2026

Public v219 accepts synthetic or de-identified portal uploads. PR #306 merged after all 18 checks passed. The work below prepares the client upload path for EU processing.

## Capture and scanning

The owner selected the Canon MF750C for paper capture and self-hosted ClamAV in the EU for malware scanning. Files created by the Canon follow the same upload path as other files. [Canon MF750 series specifications](https://canon.a.bigcontent.io/v1/static/i-sensys-mf752cdw_i-sensys-mf754cdw_datasheet_en-uk_final_forweb_537d2c55b65343eba05619ed061ca026)

The candidate keeps pilot consent mandatory. When the private service binding `EU_PORTAL_CLAMAV` is present, the portal sends the validated bytes without a filename or case identifier. It requires a clean verdict for the exact SHA-256 before writing the object. A detection blocks the upload. A timeout, malformed verdict or digest mismatch leaves the reservation pending and permits a retry. Only received uploads can be listed or downloaded. Historical received files predate this check.

Run `scripts.portal_clamav:application` under an EU-hosted WSGI server behind authenticated private ingress. Configure `CLAMD_SOCKET` for the local Unix socket. Route the binding's POST /scan to that service with the original content length. Keep signatures updated and withdraw the service from readiness when signatures are stale. Configure clamd to report exceeded scan limits and encrypted or uninspectable content as blocked. Verify those settings and test scanner downtime before admitting client data. [ClamAV scanning](https://docs.clamav.net/manual/Usage/Scanning.html) · [OWASP file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## Proposed operational retention

| Material | Proposed lifecycle |
| --- | --- |
| Interrupted upload | Allow same-ID retry for 24 hours from reservation. Then reconcile and purge abandoned private objects and release their quota. |
| Detected file | Reject before storage. If a separate incident workflow must preserve a sample, isolate it in the EU with security-only access and delete within 7 days of detection unless a documented hold applies. |
| Clean portal copy | Remove the intake copy 30 days after verified transfer to the governed case record. Preserve the sole copy until transfer is confirmed. Apply the firm's matter- and jurisdiction-specific schedule to the case record. |
| Hold | Suspend disposal of the affected material for a documented legal obligation or the establishment, exercise or defence of legal claims. Record scope, basis, owner and review date. Reassess expiry on release. |

These periods are proposed operating defaults. The GDPR sets a purpose-based storage limitation and provides exceptions for specified legal obligations and claims. [GDPR Articles 5 and 17](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)

## Verification and remaining work

- With a simulated scan service, detection returned 422, an incorrect digest and an unavailable scanner returned 503, and both roles received 404 for those bytes. A matching clean verdict permitted the retry. A separate socket fixture checked the Python gateway's ClamAV framing and its clean, detection and error responses.
- The isolated portal route test exercises an R2 write followed by a lost acknowledgement. Both staff and client are denied the pending bytes. A changed-content retry conflicts and an identical retry completes once. Format-rejected files return 404 for both roles.
- In isolated Chrome, a signed-in client fixture selected a synthetic file and submitted it once. The mocked scanner rejection and upload guidance rendered in English, Russian and English again with one POST.
- Before broader use, verify actual EU placement for request processing, scanner, database, object storage, logs and backups. Connect the private service and verify verdicts on the deployed path. Require a working scanner for every identifiable upload, including after configuration loss. Decide how existing received objects are classified or rescanned.
- Implement hold-aware cleanup, confirmed transfer and backup expiry. Exercise interruption, concurrent retries, legal holds, purge and restore in EU staging. Public v219 has no automated expiry or verified EU malware service.
