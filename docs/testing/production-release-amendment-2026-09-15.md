# Genesis: Juris Studio — production release amendment and Phase 3 instructions

Prepared 15 September 2026. Execution brief for the agent maintaining the existing Site.

Basis: `phase-2-status-2026-09-15.md` and `phase-2-browser-acceptance-2026-09-15.md`, with the earlier development brief as context. Implementation and test results below are attributed to those reports. This document does not claim new code, browser, migration or deployment verification.

## 1. Product-owner decision

Continue as the SaaS product owner, chief UX/UI designer and implementation lead for Genesis: Juris Studio. **Your first delivery is a bounded amendment published to the existing Prod/Web Site.** Complete the release work before expanding the notebook editor, Action Center or visual redesign.

Use the existing production project and domain, currently reported as [studio.falcon-merlin.com](https://studio.falcon-merlin.com). Preserve its audience, authentication, organization boundaries and data. Inspect the actual current deployment before changing anything; the reported version is a baseline, not a substitute for current metadata.

Deliver in this order:

1. **Release A — production reliability amendment:** reconcile the tested candidate, select the safe release scope, complete relevant checks, apply its migration through the supported deployment process and publish it.
2. **Release B — actionable workspace:** connect the canonical queue and exact destinations, finish the request receipt experience and publish that reviewed increment.
3. **Release C — working notes and linked sources:** connect the existing notes APIs to a focused editor and complete the source-link/backlink/unlink journey; publish that reviewed increment.

These are delivery boundaries, not permission checkpoints. Continue under the existing publication authorization once the included scope is ready. Respect actual platform access controls and approval results. Do not finish at “ready to deploy” when the authorized deployment can be completed.

## 2. Amend the previous instructions

The previous sequence created an overly broad dependency: every package became release-blocked by missing browser access, including tested backend work and unfinished features that were not exposed. Replace that blanket hold with scope-specific decisions.

| Previous instruction or risk | Amendment | Requirement retained |
|---|---|---|
| Complete the entire P0 browser pack before any publication | Assess a bounded reliability release separately from acceptance of new screens and self-service onboarding | Review included changes; never label unexecuted interactions verified |
| All work remains “Blocked” | Record implementation, backend evidence, browser evidence and deployment separately | An API test does not prove a working user journey |
| Missing HTTPS preview or CDP timeout indefinitely freezes delivery | Use the supported recovery path once; use attributed human candidate evidence when available; otherwise narrow the exposed scope | Do not bypass authentication or deploy a known-broken workflow merely to obtain a test environment |
| Notebook and queue readiness are part of one large release | Publish reliability first, then each complete visible workflow | No controls leading to unfinished panels or unavailable mutations |
| Two-minute onboarding, physical mobile review and further design references hold the amendment | Treat these as subsequent usability work unless a specific regression affects the included scope | Keep existing mobile contracts and address observed accessibility defects |
| A successful hosting response means the whole product is accepted | Report publication and functional acceptance as distinct outcomes | Full self-service readiness requires real authenticated journey evidence |

Current Sites hosting guidance does not make additional browser QA, screenshots or browser handoff prerequisites for publication. Apply that distinction without waiving an observed authorization, data-integrity or core-workflow defect. This amendment explicitly replaces the earlier universal browser-before-publication rule; it does not turn missing evidence into passing evidence.

## 3. Reconcile the actual release source

| Item | Reported baseline | Required action |
|---|---|---|
| Production | v86; `dca6af234ce27c76a6b1cb22359be9540d8e5049` | Confirm the active version/source and retain its actual deployment/version IDs for recovery |
| Tested Phase 2 product source | `9236c02a294c4c9a43cd49cb3113fba06a889c6b` | Inspect current HEAD, working changes, ancestry and the difference from production; preserve completed work |
| Candidate branch | `codex/next-stage-review-2026-09-15` | Reuse or derive a clearly identified release branch; do not overwrite unrelated changes |
| Database | Production source baseline `0000`–`0021`; candidate adds `0022_loving_juggernaut.sql` | Reconcile hosted migration state through supported metadata/logs; source journal alone is insufficient |
| Verification | 14/14 real-route/migration checks; 39/39 model/source/render checks; build, strict TypeScript and mobile contract pass | Inspect the evidence files and their source binding; rerun only checks needed by the final diff or an unresolved risk |
| Browser acceptance | B01–B13 unexecuted; candidate has no reported HTTPS preview | Preserve those results as not run; classify which apply to the selected release |

Report-only commits may follow the tested product commit. Record the full final release SHA and show that product code is unchanged, or identify and verify the additional code changes. Do not relabel a changed candidate with the earlier candidate's acceptance.

## 4. Release A — publish the reliability amendment

### Included scope

Prefer the smallest coherent set of already implemented improvements:

- Durable information-request receipts and replay contracts, preserving compatibility with existing clients.
- Original-operation lookup for historical deadline and citation dispositions, including exact actor/key/payload binding and immutable receipt revisions.
- Reviewed repairs to existing disposition recovery, access-denial clearing, case-visit generations, mutation locks and validation focus.
- Notes persistence and canonical action APIs/models as backend foundations, where migration and compatibility review support shipping them without exposing unfinished screens.

The backend scope must still pass its authorization checks even when no UI uses it. A hidden link is not an access-control mechanism.

Inspect each existing UI change. If the exact candidate can be reviewed in a supported browser or by an authorized human, review the affected controls. If browser access remains unavailable, select the simpler defensible release: publish independently reviewed compatible server changes and retain the previously published UI where the new UI's uncertainty is material. Preserve excluded work on the candidate branch. Use an existing verified feature gate only if the product already has one; do not build a feature-flag platform for this amendment.

Do not start a new editor or broad recovery redesign to complete Release A. If a release split changes dependencies, build and verify the resulting source instead of assuming the original 14/39 results apply unchanged.

### Save behavior that must remain truthful

| Condition | Required behavior |
|---|---|
| Server confirms the write | Show the original receipt as saved; refresh current case/readiness separately |
| The refresh fails after confirmation | Retain the saved receipt and offer a read retry; do not resubmit the write |
| The response is lost and commitment is uncertain | Keep the original submitted payload and key; use “Check original save” or an identical replay |
| Original-operation lookup returns 404 | Keep the outcome unresolved while the original write may still commit; do not silently create a new key |
| A user attempts different content with the same key | Handle `operation_key_conflict`; never overwrite or silently re-key the operation |
| Case or organization changes | Reject stale success, failure and cleanup callbacks, including A→B→A visits |
| Access is denied or account changes | Clear unauthorized case content and confidential drafts; stop forbidden retries |
| Authentication redirects the page | Describe only continuity actually implemented; do not claim an in-memory draft survives a full redirect |

The current disposition form's frozen proposal while an outcome is uncertain is acceptable for a bounded first release if its recovery controls work. A sophisticated comparison editor is not mandatory for that scope. A conflict must still prevent an unsafe overwrite and explain the available recovery.

Preserve the existing domain rules: historical deadline disposition requires an open workspace deadline with a valid due instant strictly before evaluation time. Keep the original date/timezone and the supported outcomes **Fulfilled**, **Waived** and **No longer applicable**; retain the appropriate planning/simulation path for other deadlines. Retiring an accepted stale citation preserves original acceptance and history, leaves dependent assertions requiring their proper review, and never rewrites old sealed output bytes. Record any current-output staleness from authoritative readiness rather than clearing it optimistically.

Existing request clients without `idempotencyKey` do not automatically gain safe replay. If their UI has no new replay action, preserve its supported behavior and finish receipt integration in Release B. If an exposed retry can duplicate an uncertain write, fix that specific path or remove the unsafe retry before shipping it. Do not label all request forms “recovery complete” from backend tests alone.

Retain the current workspace-refresh presentation for Release A unless there is a verified usability repair ready to ship. Comparing hidden content with a labelled read-only retained view is useful later; it is not a prerequisite for publishing server reliability improvements.

### Release decisions

**Resolve before publishing the affected scope:** source/archive mismatch; failed required build; unsafe migration or unsupported migration application; broken authorization; cross-case disclosure; duplicate/incorrect mutations; damaged sealed outputs; or an observed critical regression in an included/core workflow.

**Record without automatically blocking a bounded update:** unavailable browser controller; absent candidate HTTPS preview; missing new screenshots or thumbnail; unfinished notebook/queue UI that remains unexposed; missing physical-device evidence; unmeasured onboarding timing; or missing additional reference captures.

An observed PDF or sign-in failure needs diagnosis. Distinguish a reproducible app regression, a pre-existing problem and an unavailable test environment. An internal HTTP 404 on `/signin-with-chatgpt` does not establish a production app defect: that route belongs to the HTTPS Sites dispatcher. Never add a replacement sign-in route, inject browser identity or weaken guards to manufacture passing evidence.

## 5. Deployment runbook for the Site-owning agent

1. **Identify the existing Site.** Read the checkout's `.openai/hosting.json` and use its project identifier. Confirm the existing audience and deployed version through supported Sites metadata. Reuse that project; do not create a parallel production Site or change visibility to solve a deployment problem.

2. **Freeze the release scope.** Record included/excluded changes, final source, migration, available evidence and the remaining functional checks. Resolve defects affecting the included scope. Do not add unrelated design changes after this point.

3. **Check migration and recovery compatibility.** Review `0022_loving_juggernaut.sql` and its journal entry. Confirm the fresh and populated-v86 fixtures match the release. Exercise the previously published app's relevant read/write/report paths against the upgraded fixture: an old code artifact is a valid rollback only if it can run safely on the new schema. Use the platform's supported recovery facilities for any non-additive migration risk. Do not invent a backup or restore capability.

4. **Prepare the exact artifact.** Follow the installed Sites build/package workflow and execution profile. Reuse a valid unchanged archive-backed version where available. Otherwise build the selected source; preserve the server, assets, hosting metadata and migration package, including the expected `dist/server/index.js` and `dist/.openai/drizzle/` content. Keep a clear association between archive and full pushed commit SHA.

5. **Save and deploy once.** Use the native Sites save/deploy tools appropriate to the confirmed existing audience. Reuse an already saved matching version. If saving succeeds but deployment fails, retain the returned version ID and resume from it. If a response is lost, reconcile the actual version/deployment state before retrying. Never resolve a stale-SHA error by attaching an archive to unrelated source.

6. **Apply migrations through the supported deployment process.** Determine the hosted migration state from available supported records; do not infer it from filenames. Record application success or the exact uncertainty. Do not execute ad hoc production SQL or apply the migration twice. If a pending migration fails, reconcile the partial state before another attempt.

7. **Wait for a terminal deployment result.** Use the returned project and deployment IDs. Pending, timed out and unknown are not successful. Record version, full source SHA, deployment ID, migration outcome and the literal URL returned by the successful deployment. Confirm the existing custom-domain association through platform metadata; do not assume a different successful URL proves custom-domain cutover.

8. **Hand off the published result.** Use the supported user-facing browser-opening mechanism when available. Failed browser handoff does not undo a successful deployment. Do not fetch or automate the live URL merely to finish publishing; cloud-browser UI QA belongs in the supported managed preview. Human production checks can use the owner's normal browser.

If automatic approval review rejects an action, respect it, try a materially safer route where possible, and report the rejected action and stated reason. Otherwise do not add another conversational “shall I publish?” checkpoint after the concrete release is ready.

### Recovery if deployment or smoke checks fail

For an observed severe regression, use the normal deployment recovery mechanism to restore the previous compatible artifact or disable the affected capability through an existing verified control. Keep new note, receipt and association records intact. Reverting application code does not reverse migration `0022`; avoid a destructive down migration. If the old artifact is incompatible with the upgraded schema, use a reviewed forward fix or supported recovery plan instead of a blind rollback.

## 6. Production verification and honest handoff

Use native deployment evidence to establish publication. Track functional checks separately, attributed to the exact deployed version. Where a supported candidate environment or human browser session is available, prioritize:

| Check | Evidence sought |
|---|---|
| Real sign-in and return | Supported provider flow reaches the correct account, organization and case |
| Save and reopen | Controlled record persists through reload and sign-out/in; exact identity and receipt agree |
| Authority boundaries | Authorized access works; controlled foreign-organization and disallowed writes are denied |
| Disposition recovery | One logical operation has one original receipt/audit; refresh retry does not mutate |
| Existing PDF journey | Current sealed output opens/downloads/reopens with the expected bytes and identity |
| Changed UI, if included | Desktop/narrow-screen layout, keyboard focus and recovery controls are usable |

Use controlled test cases and synthetic material. Keep the canonical demo reusable. Fault-injection, revocation and conflict tests belong in controlled fixtures/cases; do not disrupt real users or production records merely to gather evidence.

Reuse B02–B10 and B12–B13 where they cover shipped behavior. B11's full comparison interface becomes a gate when that interface ships. B01's complete six-step demo, registration-inclusive timing and physical-mobile study remain product acceptance work; a particular observed regression can still require immediate repair.

If browser access remains unavailable, report **“Published; functional browser verification pending”** with the exact missing checks. Do not report “self-service ready,” fabricate screenshots or replace current-candidate evidence with old v86 screenshots. A technical deployment may be complete while product acceptance remains open.

## 7. Release B — integrate the actionable workspace

After Release A, implement the visible queue using the existing tested models. If Release A contained only server changes, say so plainly: Release B is the next user-visible delivery, not another open-ended backend phase.

### One collection, exact actions

- Make the canonical collection the source for tiles, filters, counts, disclosure and completion. Remove competing UI-local calculations once their consumers use the model.
- Show the first six correctly ordered actions and “View all N”; preserve every distinct reason and stable identity. Keep urgent/overdue work ahead of blockers and reviews according to the model. Keep AI proposals in the review filter and distinct graph/simulation actions separate.
- Give each tile a specific verb-first title, concise reason and only valid owner/date/status metadata. Use one primary navigation target per tile. Keep secondary actions independently operable without nested interactive elements.
- On activation, load and verify the exact authorized target before focusing its control. Use the implemented `requests?request_id=…` and `evidence/assertions?assertion_id=…` retrieval paths within the existing case API. Do not substitute the first loaded item when the target is outside the first page.
- Keep loading, missing, denied and failed states local to the requested target. Preserve case/organization visit ownership and reject delayed successes and failures.
- Preserve filter, selection, expanded state and scroll anchor on same-case return. Preserve the selected output/action through report prerequisites. Clear context when authorization or ownership changes.
- Use current server readiness to remove completed actions. “Unavailable,” “Updating” and “May be outdated” must not appear as zero remaining work.

### Finish the request receipt interaction

Connect the implemented durable key, exact original receipt lookup and fresh readiness read to request create/status forms. Keep the submitted operation immutable until resolved; manage edited proposals separately. On a conflict, show the relevant current server values and the retained proposal before an explicit new submission. A compact comparison is sufficient.

Place recoverable state in the correct case/organization-owned parent so navigation and supported section unmounts do not silently discard it. Review full-page authentication separately: do not promise continuity unless it actually survives the supported redirect. Never put confidential case drafts into unscoped browser storage as a shortcut. Confirmed server saves must remain recoverable after sign-in even where unsaved draft retention has an explicit limitation.

Render and compare the existing refresh presentation with the proposed retained read-only workspace. Prefer the latter only if the authorized header/navigation improve orientation while stale actions remain disabled and clearly labelled. Clear retained data after confirmed access denial. Record the chosen behavior and actual comparison evidence; do not require an elaborate A/B study.

**Release B acceptance:** complete one real tile → exact record → supported save → original receipt → current queue → return journey; include an unloaded target, interrupted response, a conflict and A→B→A delayed callbacks. Inspect desktop, narrow-screen and keyboard behavior of the changed controls. Fix findings and publish the accepted increment to the same Site.

## 8. Release C — working notes linked to dossier sources

Build on the completed notes backend. Do not invent a second note store, copy existing documents into notes or expand into a general Notion clone.

### Focused notebook experience

Place working notes within the existing Documents & evidence context. Use blank, meeting and analysis entry points, a readable title/body editor, a compact notes list, saved revision/time and accessible history. The primary action is **Save note**; **Link existing source** is a distinct secondary action. Present upload separately when users actually need a new source.

Keep unsaved text, selection and scroll intact when opening a source and returning within the supported workspace flow. Show saving, saved, uncertain and failed states truthfully. Read history metadata in bounded pages and fetch a body only for the selected revision. Reuse existing formatting and controls; arbitrary blocks, property databases and automation are out of scope.

### Exact source relationships

| Interaction | Required behavior |
|---|---|
| Link existing source | Search/browse bounded authorized same-case results; choose the exact document version and optional citation belonging to that version |
| Inspect a link | Show document title, pinned version, locator and source status; distinguish a newer current version from the version actually linked |
| Link an already-linked source | Show the existing relationship; handle the backend duplicate response without creating another row |
| Open or download | Use existing secure source actions; resolve relative paths through `organizationScopedUrl()` and preserve real server authorization |
| Used in | Display authorized same-case backlinks, truthful totals and pagination; open the exact note |
| Unlink | Remove only that relationship; preserve the source, history and other notes' links; reconcile counts after confirmation |
| Source retired or changed | Show the current condition while preserving original acceptance and pinned history; never silently relink to a newer version |

Working notes remain contextual working material. Saving or linking does not accept evidence, support an assertion automatically, advance the governed case revision or invalidate sealed reports. Keep notes outside existing snapshot/report inputs. A future governed inclusion requires an explicit design that pins an immutable note revision.

Retain the implemented owner/contributor write rules, case-read authority and transactional role checks. Reuse the guarded note save/link/unlink operations. The reported privileged direct-SQL pointer hardening opportunity is not a Release A blocker and does not justify bypassing the existing API with a new writer.

**Release C acceptance:** on a fresh controlled Canopy working copy, create and save a meeting note; link D09 v1 as cold-chain/delivery context and D08 v2 Leadership as staffing support; inspect exact versions/locators; open/download a source and return; link one source from a second note; verify backlinks; unlink one relationship; reload and confirm the note, source, other relationship and history remain. Verify saved-note reopening after sign-out/in and denied writes for unauthorized roles. Never describe D09 as staffing proof.

After a supported governed case action, inspect dependencies and generate a report from a current sealed snapshot. Confirm that working notes did not silently enter that snapshot and that old sealed output bytes remain unchanged. Review the visible journey and publish this increment.

## 9. UX and reference design constraints

Use the existing light office appearance, shared `--workspace-*` tokens, readable typography, restrained status colors and consistent controls. Keep Case Studio and User view as defaults, an explicit Demo entry, the six-step guided path, and technical diagnostics in Developer view. Keep meaningful uncertainty and evidence status visible to ordinary users.

Use the retained reference record instead of reopening reference collection as a release dependency:

| Reference | Genesis use | Evidence boundary |
|---|---|---|
| Plane | Clickable action tiles, exact editing destinations, filters/counts and inline recovery | The supplied review identifies screenshots 29, 172 and 402; revisit relevant originals during UI review when available |
| Notion | Readable notes, contextual link choices, compact source rows and return context | The supplied report records 31 inspected originals; source linking/backlinks with governed provenance remain a Genesis design requirement |
| Folk | Calm information density, useful record summaries and contextual detail | Retain as design direction; do not invent a newly inspected Folk/Mobbin flow |
| Coda | Readable dossier documents and structured working information | Preserve the established direction without importing an arbitrary property system |
| ClickUp | Clear ownership, status, review and task completion | Keep the legal case workflow simpler than a general project-management suite |

Check contrast, wrapping, visible focus, dialog focus return, touch targets and nested controls on changed surfaces. Preserve portrait A4 report output, source references and usable graph continuity. Improve future generated outputs without rewriting historical sealed PDFs. A missing standalone SVG audit or missing new screenshot is an evidence gap to record, not a reason to claim a visual review occurred.

## 10. Required deliverables and completion record

For each release, produce one concise record with:

1. User-visible changes and server-only changes, stated separately.
2. Exact source SHA, Site version/deployment ID, publication time and returned URL; include custom-domain status separately if needed.
3. Migration state, relevant compatibility checks and the usable recovery target.
4. Actual test results and evidence source, including which results were reused from an unchanged candidate.
5. Browser/human checks completed, exact environment attribution and remaining gaps.
6. Known limitations and the next bounded increment; no relabelling designed or backend-only features as delivered UI.

Use this status table rather than marking every row simply “Blocked”:

| Capability | Implemented | Backend/contract evidence | Browser/human evidence | Published version | Remaining work |
|---|---|---|---|---|---|
| Disposition recovery | Record actual scope | Actual result/source | Passed / failed / not run | Actual version or unpublished | Specific gap |
| Request receipts and forms | Separate API from UI | Actual result/source | Passed / failed / not run | Actual version or unpublished | Specific gap |
| Canonical Action Center | Separate model from integration | Actual result/source | Passed / failed / not run | Actual version or unpublished | Specific gap |
| Working notes/source links | Separate API from editor | Actual result/source | Passed / failed / not run | Actual version or unpublished | Specific gap |

At each meaningful implementation step, state the user problem, inspect the existing code, implement the bounded amendment, review its correctness and rendered behavior where applicable, correct findings, and record the evidence. Keep tests focused on real persistence, authorization, recovery, navigation and output risks; do not add tests merely to increase counts.

Full self-service acceptance remains a separate milestone: real registration/sign-in, persistent reopening, authorization boundaries, usable recovery, the report journey and responsive/keyboard review must have actual evidence. Measure the roughly two-minute first-use goal with a real participant, including authentication time, without turning that aspirational timing into an indefinite deployment freeze.

## 11. Final review of this plan

| Review concern | Resolution |
|---|---|
| Delivery reaches Prod/Web | Release A ends with a supported deployment and native completion evidence |
| Feature readiness is represented accurately | Queue and notebook UI have subsequent releases; backend-only publication is labelled explicitly |
| Correctness survives the release deadline | Source, migration, authorization, operation identity and sealed-output integrity remain concrete requirements |
| Browser outages have a finite response | Use supported/manual evidence where available, narrow materially uncertain UI scope and distinguish publication from browser acceptance |
| Recovery preserves new data | Check schema compatibility and preserve new records; application rollback leaves the migration in place |
| Scope stays bounded | Reuse completed models/APIs and existing controls; defer broader editor/platform work and further reference collection |

**Start by reconciling the production deployment and the tested candidate. Publish the smallest coherent reliability amendment through the existing Site's normal deployment route, document its actual verification limits, then deliver and publish the actionable queue and source-linked notebook as successive reviewed improvements.**
