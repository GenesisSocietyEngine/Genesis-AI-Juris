# CV-037 / CV-038 — signed-in proposal review

## 18 November 2026: public v224 audit

#319 merged after 18 passing checks, including the successful rerun of an iOS simulator launch timeout. Canonical `d900ff07ccf31ad88c598125799ed58b56510bfc` passed exact-main web/PDF: 2,100 tests, zero failures, three inherited skips, two HTML checks, and zero vulnerabilities in both audits. Sites v224 published at 12:33:20 UTC with environment revision 42. Both origins returned the exact runtime and verified 221 assets. The custom domain initially returned seven asset 404s; a second full check passed 221/221. [Receipt](receipts/cv012-v224.json).

The user's authorized synthetic version-2 job completed on attempt 3, analyzing one 80-character range and creating one fact proposal. The statement identifies the fixture's own version-two label; its exact quotation is `CaseVant v209 version two / Вторая версия.`. CV-034's authentication fix and CV-036's documented alias handling are now production-verified. No new credentials, models, invitations or documents were introduced.

The EN review note survived switching to RU. Opening the proposal's source link focused the exact version-2 citation. An initial accept request correctly failed because the source anchor was pending, without creating an assertion. After inspecting the quotation, the authorized QA source review accepted that exact anchor. Ordinary proposal acceptance then failed with `An edited value is only valid for edit-and-accept.` The proposal remains pending; no proposal-review decision or materialized assertion has been claimed.

## CV-037 — acceptance prerequisites

The UI previously offered acceptance as soon as any citation existed, although the server required all anchors to be professionally accepted. Acceptance and edit-and-accept now remain disabled until all cited anchors are loaded, accepted and not retired. A bilingual explanation points to the existing source links. This does not weaken server checks or change rejection policy. Pending, rejected, missing, retired and fully accepted source states are covered through the real integrated parent.

## CV-038 — optional edit payload

The real parent sent `editedValue: null` for ordinary acceptance and rejection. The route treats field presence as an edit and rejects it outside edit-and-accept. The parent now includes that field only for edit-and-accept, preserving exact explicit edits and review notes. A regression drives the actual parent callbacks and checks all three serialized requests, including exact revision and proposal identity; existing route and review tests retain authority and source guards.

Validation: 36 scoped tests pass. Type checking passes. New UI behavior and successful live acceptance still await merge/release; this is not a production-complete CV-012 review claim. CV-035 still tracks untranslated Evidence controls and notices. CV-010/028/029 still need an active client.

Next: publish after green CI, accept the already source-reviewed synthetic proposal with its retained QA note, then verify the resulting record, immutable attribution, EN/RU continuity and reload. Do not regenerate or replace the existing source/proposal to bypass the failed review.

Local browser fixture: the integrated Evidence section shows disabled acceptance/edit controls for a pending anchor, the EN/RU prerequisite text, and a source link that focuses the exact citation. Desktop rendering is readable. The narrow preview did not provide usable layout evidence; mobile acceptance remains pending.
