# Actionable case workspace — 15 September 2026

Baseline: published version 82, source eb0d02cb54b4463ce889b618f0c303b7306cbf4a. Canonical Canopy source content, case permissions, database schema and the audit contract are preserved. The snapshot-list response additionally exposes its existing sealed flag so the UI can enforce report prerequisites. Sealed manifests remain unchanged.

## References

Located `Plane web Sep 2025.zip` (145,370,043 bytes). Both available-file download attempts returned 502. The Windows OneDrive path is inaccessible. Both supplied OneDrive links (`e=xUMXib`, then `e=fXQ3Zi`) return an HTML shell and 401 for an ordinary download. The latest file link without the e parameter was also tested: 200 HTML shell and 401 on ordinary download. No screenshot filename from that ZIP can honestly be cited as inspected.

Secondary official Plane images inspected:
- `blog-asset-issue-tracking-in-plane-intake-desktop-light-d0e3f0c1.webp`: a compact selectable queue, blue selection outline, status and contextual Accept/Decline controls.
- `blog-asset-issue-tracking-in-plane-work-item-desktop-light-85341650.webp`: an action title, compact owner/status metadata, readable rationale and activity below.
- Source: https://plane.so/blog/how-to-run-issue-tracking-in-plane-a-practical-walkthrough . These are current official images, not the supplied September 2025 archive.

Retained Coda/ClickUp findings are documented in `workspace-redesign-2026-09-15.md`: Coda `Coda web Mar 2024 99.png` for narrative alongside structured records; ClickUp `ClickUp web Nov 2025 158.png` for explicit status and a focused confirmation. Those prior inspected references underpin the existing shared office system.

Genesis adaptations: verb-first action tiles, a brief reason and actual ownership where returned, exact record targeting, a visible target outline, and an explicit return to case actions. These are original product decisions. Dense records remain lists; only outstanding actions become tiles. Overview initially shows six actions with progressive disclosure.

## Action mapping

| Existing point | Action | Exact destination | Completion |
| --- | --- | --- | --- |
| Studio context warning | Review case context | Title or publishable-context field, according to missing input | Explicit confirmation returns to updated checks |
| Missing required case item | Add missing evidence / required item | Connected-item form, explicit related step | Appends a node and connection, preserves history and updates checks |
| Empty initial model | Build the initial case draft | Brief input | Existing draft generation workflow |
| Missing role/legal date/source | Complete the relevant field | Actual focused input, including non-tax cases | Existing draft edits; return to checks |
| Saved-case readiness findings | Resolve the named finding | Exact document, assertion, citation, proposal or request | Server mutation retains revision checks; reloads case readiness |
| Information request | Provide requested information | Response form with the exact request selected | Explicit document choice, receipt feedback and linked source |
| Missing key deadline | Set the key case deadline | Local date/time input | Existing metadata endpoint saves ISO timestamp and browser timezone |
| Historical overdue deadline | Review overdue deadline | Exact register entry and review-request control | Tracks a review request; does not claim disposition is supported |
| Accepted assertion needing correction | Correct or supersede | Exact assertion with confirmation and replacement-evidence route | Existing supersession API preserves the historical record |
| Report missing | Save evidence / generate report | Snapshot form first, then report form | Existing snapshot and output workflows |
| Outdated report | Refresh outdated report | Exact report then new snapshot | Original output remains available |

## Stage 1 review

Acceptance: each Studio warning opens the relevant control; completion updates validation without silently rewriting existing nodes, sources or permissions.

Browser: Canopy step 5 showed two warnings. Context tile focused its text field; confirmation returned and reduced the count to one. The evidence tile focused its new form. Entered a bounded excerpt from synthetic D09 v1, selected the cold-chain step, and added it. Count became zero; no disconnected-graph warning was created. The preliminary report tile opened the real A4 report dialog. Typecheck passed.

Review corrections: fixed link direction and 500-link guard; added legal controls for non-tax playbooks; distinguished title/version/role targets; preserved return navigation during identity edits; reused save size/busy guards; retained visible unknown-check errors and protected-case restrictions. Source loading uses a bounded observer that disconnects when the target mounts.

The save action reached `/signin-with-chatgpt` on the managed preview and returned 404. Authenticated browser persistence and the complete registration journey cannot be verified there. This is separate from the verified client editing/report flow.

## Stage 2 review

Acceptance: preserve the active case and exact record; never default a response to the first request or first document; explain unsupported prerequisites; show receipt proof and return navigation.

The browser harness renders the actual production Overview and Requests components with synthetic Canopy content and explicitly labelled local callbacks. It is isolated from server data and is removed from the published build. Server integration checks are separate evidence.

Stage 2 browser review: the second request tile opened its response form with `staffing` selected and its source blank. After choosing the Staffing confirmation addendum, the callback changed only that request to Received and displayed its exact source. Return to actions reduced the queue from two to one. Received filtering showed only that task. The key-deadline input submitted the chosen local date and displayed the normalized date.

At 390px, Tab then Enter activated the second tile, focused the exact request selector, and keyboard selection/confirmation produced Received. The initial narrow tiles were too tall; moving the action cue below the text fixed wrapping. This was a live narrow iframe interaction, not a native mobile-device test. No visible horizontal overflow appeared in the reviewed tiles/forms.

Report prerequisite review: an old revision-16 snapshot could not be chosen for a revision-17 report. The action opened the snapshot form; its callback made a current sealed snapshot available, after which the next tile opened the report form with only revision 17 selectable. No browser harness callback is claimed as a persisted server mutation.

Additional review fixes: scope uploads and AI completion feedback to the active case; preserve the request through its document-upload prerequisite and provide a return link; carry package identity into package-link fields; focus an initially unloaded proposal when its page arrives; keep permission explanations addressable; distinguish missing readiness from completed work. Received documents now have a link to inspect the exact source.

The final permission review confirmed that a reviewer can create the evidence snapshot permitted by the existing server policy, while package linking remains restricted to case writers. The actual component rendered the snapshot form without the link form and submitted its labelled local callback. No server permission was broadened. A further exact-destination review caught a request-switch edge case: entering through request A, selecting B, then adding its missing source could preserve A in the return route. The source prerequisite now carries the locally selected request explicitly. In the actual component harness, demand → staffing → source availability → return retained staffing; confirming its source removed only staffing from the two-item queue. The reviewer package-link target now focuses its own permission explanation instead of the unrelated snapshot locale. Browser focus, snapshot callback and panel spacing were reviewed after this correction.

## Final checks and practical limits

- 42 focused tests passed: action destinations, graph preservation/limits, snapshot prerequisites, source/request proof, existing workspace controls, evidence/readiness handlers, canonical Canopy fixtures and case playbooks.
- Seven Canopy integration checks passed in the isolated real-handler D1/R2 environment, including all four scenarios, causal copy isolation, request/source review, snapshots, generated PDFs, independent approval, reopening and staleness. These are server integration results, not authenticated browser results.
- Strict typecheck, focused React lint and full-project ESLint passed. The final release build completed successfully through all five Vinext stages, including the locked 18-route canonical mobile contract. Temporary browser harness files are absent from public assets and release output. The build retains a pre-existing large-chunk advisory; it is not a failed check.
- The default Case Studio entry, explicit Demo choice, User view and vertical graph orientation were observed. Report-dialog Escape dismissal passed. Existing import labels and navigation were retained.
- A scripted ready-page entry → Demo → Canopy → Test → exact context field took 12.214 seconds. This measures navigation only. A cold preview attempt during refresh needed a retry; it is not a human first-use or registration timing study. The approximately two-minute registration-inclusive goal is unverified because the managed sign-in route returns 404.
- Shared foreground contrast against white: body 14.26:1, secondary text 5.99:1, action blue 6.60:1. Focus is visible and actions use native buttons/selects without nested controls.

Remaining priorities:
1. Verify registration, authenticated persistence and organization switching in a working signed-in browser environment.
2. Historical deadline disposition and retirement of accepted stale citations need supported governed mutations. The interface identifies those limitations and offers the available review/source workflow; it does not claim the underlying blocker is cleared.
3. Inspect the supplied Plane ZIP when its bytes are available. The final repeated folder link was separately tested: 200 HTML shell, 401 download; the file-copy retry again returned 502. No archive screenshot was fabricated or substituted silently.
4. Run a timed human first-use check and native mobile device check before claiming unrestricted customer onboarding readiness.

Assessment: the available demo and case-action flow is clearer and more actionable. Exact task selection avoids searching and prevents first-item mistakes; report prerequisites avoid a predictable failed request. It is suitable for a guided demo of the verified paths, with the above limits disclosed. An unattended end-to-end customer trial is not yet verified.

## Representative screenshots

Before: [passive task cards](action-tiles-images/tasks-before.jpg). This is the baseline production component in the explicitly labelled synthetic browser harness.

After: [actionable task queue](action-tiles-images/tasks-after.jpg), in the explicitly labelled synthetic harness. The same request content now exposes a direct action from the case overview.

[Studio actions](action-tiles-images/studio-actions.jpg) and [completed actions](action-tiles-images/studio-complete.jpg). These show the running Studio preview. The completed example uses a user-entered synthetic D09 reference and does not alter the canonical fixture.


## Plane archive follow-up

The direct upload `Plane web Sep 2025(2).zip` has now been extracted and visually inspected: 403 PNGs surveyed, 13 representative screenshots inspected individually. **Archive inspection is Verified.** See [the dated reference mapping and next-stage review](plane-reference-review-2026-09-15.md). Earlier download failures above describe the prior state. Browser and authenticated-journey limitations remain unresolved; this follow-up does not claim new product UI or PDF browser verification.
