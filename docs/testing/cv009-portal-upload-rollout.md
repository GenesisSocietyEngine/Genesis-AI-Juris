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

## Retention implementation and EU connection · 17 November 2026

PR #307 merged at `769881cd` after all 18 checks passed. Sites reported v219. Its hosting manifest identifies D1 and R2 by binding name. The live environment has no configured scanner origin. Neither response establishes EU residency.

### Operator deployment

Use a customer-controlled EU staging environment first. Configure EU jurisdiction for D1 and R2, EU-only request processing on both the portal and scanner ingress, and EU destinations for operational logs, backups and restores. Obtain the effective resource IDs and settings from the provider. Record the scanner VM region, signature freshness and restore location. A successful scan alone cannot identify where the request or retained bytes were processed. [D1 jurisdiction](https://developers.cloudflare.com/d1/configuration/data-location/) · [R2 jurisdiction](https://developers.cloudflare.com/r2/reference/data-location/)

Run the existing ClamAV gateway beside clamd on a private EU host. The portal accepts its existing private service binding or an HTTPS origin protected by a Cloudflare Access service-token policy. For HTTPS, set `PORTAL_SCANNER_ORIGIN` to the exact origin, `PORTAL_SCANNER_REQUIRED=1`, and store `PORTAL_SCANNER_CLIENT_ID` and `PORTAL_SCANNER_CLIENT_SECRET` as runtime secrets. Deny direct origin access. Partial settings, non-HTTPS origins and unexpected redirects fail closed. Synthetic pilot consent remains mandatory. [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

Apply migration 0038 before deploying the separate retention Worker at `worker/portal-retention.ts`. Bind the **same** EU D1 database and R2 bucket as the portal. Disable workers.dev and preview URLs, expose only a private operator binding, set `PORTAL_RETENTION_TOKEN` in the secret store and configure an hourly cron. Authenticate the operator caller before forwarding its request. Each POST uses a bearer credential and JSON with one upload ID. Supported actions are:

| Action | Additional fields | Effect |
| --- | --- | --- |
| hold | holdId (UUID), basis, owner, reviewOn (YYYY-MM-DD) | Places a hold on the existing upload. A review date never releases it automatically. |
| release | holdId | Releases only the specified hold. Other holds continue to apply. |
| transfer | version | Records a verified existing same-case copy with matching type, size and SHA-256. The 30-day period starts here. |
| expire | none | Rechecks eligibility and the governed copy, claims disposal in D1, then deletes the portal object. Safe to retry after interruption. |

The scheduled sweep expires pending reservations after 24 hours and verified transferred copies after 30 days. A permanent retired ID prevents an old retry from republishing purged bytes. A second cleanup after one day reconciles late object writes. Detected bytes are rejected before storage. No quarantine sample collection is enabled. The worker covers primary intake storage. Backup expiry, retention of governed case records, and restoration with current holds and disposal records require provider-level controls.

### Acceptance on the candidate

- Isolated D1/R2 verified refusal to expire the sole received copy, refusal of a mismatched transfer, the 30-day window, overlapping holds and release, repeated disposal, physical removal of the R2 intake object, survival of the exact governed bytes, rejected reuse of a retired ID and scheduled cleanup of an interrupted object older than 24 hours.
- An isolated transport test verified the configured HTTPS destination, synthetic Access headers, original bytes and failure with incomplete or insecure settings. The client portal scenario covered clean, blocked, unavailable and mismatched scanner results.
- Chrome submitted a synthetic upload in English and another in Russian using an isolated signed-in fixture with simulated responses. Each success translated in both directions without another POST. A separate blocked upload also translated in both directions.
- Live EU scanner connectivity, placement and backup/restore evidence are outstanding. Before publishing the operator or enabling identifiable files, rehearse with synthetic uploads against the provisioned EU resources, including a hold across restore and replay of post-backup disposals.
