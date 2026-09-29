# Amendment browser capability inventory

27 September 2026, 20:24 UTC. Bounded read-only capability review prompted by `RELEASE_DECISION-amended.md`. Application source was not changed. The available checkout is `C:/PROJECTS/Genesis-AI-Juris/.worktrees/ux-convergence-2026-09-27`, HEAD `80b234051c82e12e93da97d0866337420030a99c`; the previously verified application commit remains `8ee07c0fcf5a6ea78f5fd9c435bfe4b013e052b6`, built input digest `25d6309ef9adf2ff039c02fe0bffef4a8a754dde11334a3d8f7f621e7dcc34ec`. The amendment's reviewer-device-offline statement describes that reviewing session, not this available checkout.

## Current documented capabilities

Refreshed CUA documentation with `cua.rewriteDocumentation()`, then read both connected browsers' advertised capability lists, the viewport capability, `file-uploads`, `chrome-file-upload-troubleshooting`, and `local-web-development`. Chrome (ID 1) and Edge (ID 2) both advertise **viewport** as their only browser capability. Page inspection provides accessibility trees, screenshots, ordinary keyboard/locator actions and read-only DOM evaluation. Native computer APIs are disabled in this tool session.

| Check | Current capability and classification |
|---|---|
| Keyboard, labels, focus, visible errors and page/dialog containment | Supported through ordinary page controls and read-only DOM/AX inspection. Prior scoped passes remain in [BROWSER_REVIEW.md](BROWSER_REVIEW.md); capability availability alone is not another pass. |
| Responsive size and overflow | Supported by explicit viewport `set({width,height})` and `reset()`. The measured 390×844 report-history result remains valid within [RECONCILIATION_BROWSER.md](RECONCILIATION_BROWSER.md)'s scope. |
| Actual 200% browser zoom | **NOT_RUN.** No documented zoom setter, zoom-level readback or browser-chrome inspection is exposed. Generic key injection by itself does not establish a verified 200% setting. Neither resizing the viewport, CSS scaling, device-pixel ratio nor a PDF viewer's percentage is substituted for this acceptance check. |
| Real screen reader | **NOT_RUN.** No documented screen-reader launch/control, speech output or reading-cursor observation is available. AX/DOM accessibility information is not evidence of an actual assistive-technology reading journey. |
| Source-v2 browser upload | **BLOCKED.** The prior security/permission gate has not been shown resolved. No new chooser/setFiles attempt was made in this inventory. |

## Upload prerequisite and security boundary

The previously attempted file is the isolated synthetic `.artifacts/ux-reconciliation-auth/fixture-c-source-v2.txt`: it changes the fictional register from 300 to 320 commitments and explicitly preserves the historical version-one meaning. Its intended destination is the document-version form in fixture C on `http://localhost:5281`, organization `org_15eba3abeeb241c6899481f557186dd4`, dossier `dossier_4c45577c6bc54528b9330d018a893312`. The full prior target was:

```text
http://localhost:5281/matters?collection=team&organization=org_15eba3abeeb241c6899481f557186dd4.1.1.actor_f2cda772e48213c433230b4319b195d5&dossier=dossier_4c45577c6bc54528b9330d018a893312&section=documents
```

The previous documented file chooser flow failed at `fileChooser.setFiles`: a browser security check was unavailable; the permission request could not complete, so access was not granted. Its response prohibited an indirect workaround and allowed retry only after resolution. No source version was uploaded by that attempt.

Current Chromium upload documentation supplies this user-operated prerequisite:

> To enable file upload, open chrome://extensions, click Details under the ChatGPT browser extension, and enable "Allow access to file URLs." See [here](https://developers.openai.com/codex/app/chrome-extension#upload-files) for details.

A single **read-only** attempt to open `chrome://extensions/` to inspect that prerequisite was rejected by the Browser Use URL policy. The rejection explicitly prohibited alternate surfaces, raw browser commands and indirect workarounds for that blocked action. Inspection stopped. No extension setting was read or changed, so this inventory does **not** establish that the setting was absent, disabled, sufficient to resolve the original failure, or now enabled. No permission prompt, upload, alternate tool/API upload, native picker fallback or browser configuration change followed.

Resolution requires a user-operated prerequisite check and evidence that the original browser security/permission check can now complete, followed by an ordinary chooser attempt within the existing authorized synthetic-file scope. This is a browser-tool blocker, not evidence of an application upload defect. The source-v2/dependent-output journey remains open; independent checks can continue.

## Existing local identity and feasible independent work

Chrome's current tab inventory contained no `localhost:5281` QA tabs; prior ephemeral test tabs were cleaned up. This does not prove that the previously created ordinary owner session cookie was lost or expired. The earlier real owner session, isolated migrated database and synthetic fixture C/D remain documented in [RECONCILIATION_BROWSER.md](RECONCILIATION_BROWSER.md) and [LIVE_FIXTURE_CD.md](LIVE_FIXTURE_CD.md). No cookies, session tokens or passwords were inspected or copied for this inventory.

Root restarted the unchanged built worker at `localhost:5281` against `.artifacts/ux-reconciliation-auth/state` (session 97473). A fresh ordinary Account page displayed **Current session / Synthetic UX owner**; no new login was necessary. Fixture C then settled with the correct synthetic organization and Owner role, revision 18, Fact Accepted, Assumption and Contradiction Needs review, and three exact version-one citations Accepted. The two pending assertions each exposed ordinary Accept/Reject controls; the accepted fact exposed correction/supersession. These were inspected only, with no review action taken.

Decision package displayed **0 exact versions** and **0 immutable manifests**, with no linked package or snapshot. Its ordinary form requires Package ID, Exact version and Package fingerprint, with optional accepted graph-proposal and simulation-receipt IDs; it explicitly says the server revalidates published graph, lineage, proposal and supplied receipt proof. It also exposes Create snapshot from revision 18. This is not automatic Studio custom-case linkage. Existing source/assumption review and explicit package/snapshot preparation are concrete independent next steps. The missing package/snapshot is an actual prerequisite for the dependent-output journey, not an invented claim that such an output already exists.

## Additional authorized wrong-organization browser check

Root subsequently authorized this read-only navigation check on the same candidate. Through the ordinary organization selector, the owner switched from fixture C's organization to its own separate **Personal workspace**. The interstitial showed Checking the selected organization, then the personal organization case list settled with **0 cases** and no selected dossier.

An exact deep link combining that authorized personal-organization selection with fixture C's known dossier ID settled to **This case is no longer available** and **Private case content is hidden. Access must be confirmed before it can be shown again.** The full accessibility tree contained the account/navigation, selected personal organization and access-recovery controls; it contained no fixture title, factual/assumption/contradiction statements or source-register title. This is **PASS for the observed browser wrong-organization concealment**, separate from prior API authorization checks. It is not a different-account or grant-revocation pass.

Returning through the ordinary organization selector encountered a browser command-dispatch deadline. The documented recovery guidance was read; one fresh tab was requested at the already-authorized fixture C URL, but that request timed out and reset the CUA runtime. The return navigation therefore is **not confirmed**. A read-only DOM boolean check also timed out before these attempts, so no DOM boolean measurement is invented; the concealment observation above rests on the successful full AX result. No unrelated browser/account control or alternate automation mechanism was used. Further browser work requires the documented CUA connection to respond again. This connection issue does not establish an application defect or change the earlier successful observations.

No new password, membership, grant, hosted identity or account changes are proposed. Other synthetic roles retain their previous browser-login **NOT_RUN** status unless an ordinary credential/session path becomes available; separate actual API role checks do not substitute for browser checks. Production v102 identities are not current-candidate acceptance.

Engineering acceptance and production release remain **BLOCKED**, and external pilot remains **NO-GO**. This inventory does not waive actual zoom, real screen-reader, source-version/review, role or participant gates.
