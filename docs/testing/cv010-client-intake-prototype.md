# CV-010 · Client intake and signature prototype

## Review the flow

From the repository root, run `python -m http.server 18410 --bind 127.0.0.1 --directory examples/client-intake` and open [the local prototype](http://127.0.0.1:18410/). Use synthetic answers. The role selector simulates three users. Reloading discards the fixture.

1. As **Assigned client**, read the versioned engagement summary, answer the intake question and submit. The signature request still requires staff authorization.
2. Switch to **Case staff** and authorize this recipient for this document version.
3. Switch back to **Assigned client**. Review the document, select the confirmation checkbox and record a test signature. Switch languages during the flow to check the same record.
4. As **Case staff**, create a new version. It requires fresh intake and authorization. Revoke test access to exercise the client denial and retained staff history.

## Evidence and production boundary

Each event identifies the case, document, version, assigned recipient, acting fixture user, action, sequence and timestamp. The intake event records the answer. The simulated signature records the reviewed text and references the intake and authorization events. A matching repeat returns the existing completion. A stale version, wrong client or revoked grant cannot complete the modeled step.

This is an in-memory interaction prototype. Its role picker and browser clock simulate identity and time. Production integration requires server-side authorization for the exact grant and version, durable completion evidence and a verified provider response. Provider selection and real signatures remain open.

## Acceptance · 17 November 2026

The local browser walkthrough submitted English intake, switched to staff, authorized version 1, switched to Russian, and returned to the assigned client. The signature button became available only after explicit review. Receipt 3 referenced staff authorization 2. Selecting the other client displayed denial and hid the answer and receipt history.

Both workflow tests passed with `node --test examples/client-intake/workflow.test.mjs`. They cover blank and conflicting intake, repeated submissions, missing authorization, explicit review, wrong recipient, version replacement, revocation, retained history and signature evidence. No active portal grant or signing provider was used.
