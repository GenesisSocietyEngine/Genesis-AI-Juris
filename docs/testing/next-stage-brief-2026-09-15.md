# Genesis: Juris Studio — next-stage product improvement instructions

Prepared 15 September 2026; updated to incorporate Folk and Notion reference directions. Ready to use as the next implementation brief.

## Mandate and starting evidence

Act as the SaaS product owner, chief UX/UI designer and implementation lead for Genesis: Juris Studio. Complete the next improvements through source review, implementation, browser inspection and verification. Evaluate your own work after every meaningful stage.

Optimize for a professional user who needs to understand a case, resolve its outstanding work and produce an explainable decision report. The defining product object remains the case and its decision package.

Use the supplied **Plane reference review — 15 September 2026** as the starting record. It reports published version **85**, source `91fdb58340a5dbef1af9270f37cce1a43ea2fda9`, following version-84 migration recovery. Confirm the current source and running deployment before editing; reconcile any newer work.

Apply these baseline corrections:

- The Plane reference-access blocker is resolved. The report records extraction and integrity verification of 403 PNG screenshots and individual inspection of 13 originals. Locate the existing extracted references and contact sheets when needed.
- Deadline disposition and citation retirement already have implementation surfaces. Inspect and improve their existing handlers, permissions and presentation before proposing additional endpoints or schema changes.
- The latest checkpoint was reference review and source inspection only. Its eight UI proposals are outstanding proposals, not completed product changes.
- New rendered review, the private-case PDF retest, authenticated persistence, organization switching, registration-inclusive timing and native mobile verification remain unverified in that record.
- Preserve existing canonical case content, historical records, sealed outputs and server permission rules while improving the user journeys.

Keep the existing light office design system. Use Coda for structured analysis, ClickUp for tasks and reviews, the inspected Plane archive for navigation and contextual actions, Folk for concise record presentation, and Notion for connected dossiers and notes. Translate these references into one consistent Genesis interface. These assignments describe design responsibilities, not five separate visual themes.

## Stage 1 — P0: restore browser verification and verify the report journey

First establish a functioning supported browser connection to the correct application environment. Diagnose the reported tab-discovery timeout using the environment's documented recovery procedure. Treat browser connectivity, application routing and authentication as separate problems.

If browser access remains blocked, continue source inspection, contract review and focused server checks that do not depend on it. Record the exact dependency. Accept a user-facing implementation stage only after its required rendered review succeeds.

Reproduce the reported PDF error in an authorized signed-in session. Determine whether it still exists in the current version; the record mentions a corrected adapter awaiting interface verification. Capture the failing user action, case revision, response and relevant application error before selecting a fix.

Verify this journey using controlled data first, then the affected private case where authorized:

1. Open the intended case and inspect its report prerequisites.
2. Create or select a current sealed evidence snapshot through the supported workflow.
3. Generate the report and receive meaningful progress and completion feedback.
4. Open and download the generated PDF.
5. Inspect its contents: correct case and revision, portrait A4 presentation, readable labels, citations, wrapping and page connectors where applicable.
6. Reopen the case and find the same saved output with its correct status.

Explain unmet prerequisites beside the Generate report action and link to the exact remedy. A generation failure should preserve the case and selected options and offer an appropriate retry or return action. Distinguish generation failure from preview or download failure: an already generated report may still be available.

Preserve access controls when opening files. Keep historical reports available with accurate revision and staleness information. Use controlled demo content in shareable verification screenshots.

**Acceptance:** a real browser produces and opens the expected PDF, including the previously affected path where available. Identify any difference between preview and production behavior. A successful server test or HTTP response alone is insufficient evidence of this journey.

## Stage 2 — P0: make save confirmation and recovery accurate

Address the source finding that citation feedback announces a refreshed queue before `loadMatter` completes. Inspect the existing completion handlers and make mutation outcome and subsequent read outcome observable separately.

Use consistent user-facing behavior across citation retirement, deadline disposition and comparable actions:

| Actual result | User-facing feedback | Recovery and state handling |
| --- | --- | --- |
| Write pending | Saving outcome… | Keep input visible and prevent duplicate submission. |
| Write confirmed; refresh pending | Outcome saved. Updating case actions… | Retain the receipt; mark queue information as updating. |
| Write and refresh confirmed | Outcome saved, with the resulting next step | Update counts and readiness from the authoritative refreshed state. |
| Write confirmed; refresh failed | Outcome saved. Case actions could not be updated. | Offer Retry update; retain the receipt and mark prior queue data as potentially outdated. |
| Write outcome unknown after interruption | We could not confirm whether the outcome was saved. | Reconcile with the server before resubmitting; use the existing idempotency contract where supported. |
| Revision conflict | This record changed while you were reviewing it. | Preserve the proposed input and show the current record before explicit resubmission. |
| Session expired | Sign in to finish this action. | Preserve supported draft state and return to the same record after authentication. |
| Validation or permission failure | Explain the actual field or permission issue | Focus the relevant field or explanation; offer a supported next action. |

Check the actual response and error contracts before mapping these states. Reuse existing mechanisms where possible. If the server cannot establish an uncertain write's outcome, provide a safe verification route rather than silently repeating it.

Display the returned outcome receipt: affected record, recorded outcome, reason, actor, time and supporting reference when provided. Link to the exact audit event using its returned identifier. Handle unavailable legacy receipt fields honestly.

**Acceptance:** controlled checks cover successful saving, post-save refresh failure, an uncertain write, a revision conflict and expired authentication. No confirmed save is reported as an unsaved change; no failed refresh produces a false ready state; entered input survives recoverable failures.

## Stage 3 — P1: make the action queue specific, ordered and consistent

Improve the existing `MatterActionCenter` and `matter-actions` model. Use one canonical action collection for ordering, deduplication, filters and counts.

Replace repeated generic titles with concise titles that identify the actual work, for example “Provide staffing confirmation” or “Review delivery deadline.” These examples are illustrative; derive production wording from the actual request and finding. Keep owner, priority, date and overdue status distinct, showing only available data.

Define a documented ordering rule that prioritizes known urgent work and blockers, then required reviews and other supported next steps. Use stable tie-breaking. Determine urgency from actual dates, supported priorities and readiness consequences; derive historical eligibility from the domain rules and timezone context. Missing data should not imply low risk or completion.

Deduplicate the same action against the same record while preserving its related findings and reasons. Keep actions on different records distinct even if their labels match.

Initially show up to six actions and an accurate “View all N actions” control when additional work exists. Rename “priority” controls if they only truncate a list. Keep filters compact and based on supported state; show active filters, result counts and a clear reset. Announce changed counts accessibly.

After an action, retain the originating case, filter, selection and useful scroll position. Reset context when the organization or case changes. Ensure delayed responses from the previous context cannot update the current queue. Derive completion and readiness from server-confirmed state.

Use an honest empty state: no matching actions under a filter is different from no outstanding case actions, and both differ from an unavailable readiness calculation.

**Acceptance:** differently named requests remain distinct, repeat findings produce one appropriate action, ordering is stable, shown and total counts agree, return navigation retains context, and filters never turn missing data into apparent completion.

## Stage 4 — P1: remove unnecessary navigation from record reviews

### Deadline review

Make an explicit historical-deadline action open the selected disposition form directly. Show the case, original deadline, date/timezone, status and available supporting information before asking for an outcome or reason. Open only the explicitly selected review and focus its heading or first relevant control.

Future or projected deadlines should use date-appropriate wording and their supported workflow. Present historical disposition only when eligible, with server enforcement retained. Preserve the original date and record history.

### Citation and dependent-assertion review

Replace plain fragment links that fail when an assertion is not loaded with the existing local target-loading and focus mechanism. Provide an explicit “Review assertion” action for each relevant dependency. Handle inaccessible or missing records with a clear explanation.

After retirement, explain any remaining unsupported assertions and stale outputs. Offer the next supported review or replacement-evidence action. Derive report readiness from resolved dependencies and the current sealed snapshot; retirement itself is not assertion repair.

### Presentation choice

Retain working pages and forms. Introduce a contextual drawer only if a before/after browser comparison demonstrates better context retention or fewer unnecessary steps. A drawer must support accessible focus, close behavior, return navigation and narrow screens; its existence alone is not an improvement.

**Acceptance:** one explicit action reaches the correct editable review; selected record identity remains visible; a not-yet-loaded dependent assertion becomes reachable; future deadlines receive appropriate actions; completion leaves accurate consequences and a reliable return route.

## Stage 5 — P1: connected dossiers, notebooks, documents and evidence

The user explicitly identifies Notion's linking of documents and evidence to notebooks/dossiers as a relevant product concept. Implement this as a connected information workflow using Genesis's existing source and review model.

### Organization and scope

Treat the existing case as the dossier. Within its current navigation, provide notes and optional notebook groupings alongside Documents & evidence. Inspect existing note/editor capabilities first. A notebook should organize work inside the case; preserve the case's identity, guided workflow and access boundary. Choose the smallest navigation change that makes notes easy to find, without introducing competing global sections for Cases, Dossiers and Notebooks.

A dossier overview should bring together its brief, relevant notes, linked documents/evidence and next actions. Keep these as views of the underlying records. Use a readable page with a concise title, supported status/owner properties, author and update information, and a modest set of editing controls. Start with blank notes and simple templates for meeting notes and analysis; template headings should not imply that entered text is an accepted finding.

Notion documents pages with properties and openable record views, plus nested pages with sidebar/breadcrumb navigation. These support the organizational proposal; they do not establish Genesis's evidentiary or permission rules. Sources: [Notion database pages](https://www.notion.com/help/intro-to-databases) and [subpages](https://www.notion.com/help/create-a-subpage).

### Link existing records instead of recreating attachments

Provide a visible **Link existing** action in the dossier, notebook and note where appropriate. Open a searchable picker scoped to records the current user may access. Show enough information to choose correctly: title, document/evidence type, source version and applicable status. Indicate records already linked and avoid duplicate associations. Keep Upload new as a distinct action when the source is not yet present.

Render linked records as compact, openable rows or cards. Show their actual source identity and open the selected source, or its precise evidence location, with a clear return to the note and preserved reading position. Offer **Link to dossier/notebook** from the source viewer as the reciprocal entry point where authorized.

Reuse one authoritative source record within its permitted ownership boundary. Separate the source from the link that places it in a notebook or dossier. Unlinking removes that association while leaving the underlying source intact. A note can link several sources, and a source can appear in several authorized notes or notebook views.

For reuse across cases, follow the existing ownership and case-copy isolation contracts. Where the system supports organization-owned shared sources, multiple authorized dossiers may reference the same source version. Where a record is case-owned, preserve the supported import/copy behavior and its lineage. A visual link must never silently introduce shared editing or transfer another case's evidence acceptance decision.

Notion's official relation documentation describes searchable links between records and optional reciprocal relations. Genesis's version handling and evidentiary semantics below are our proposed adaptation. Source: [Notion relations](https://www.notion.com/help/relations-and-rollups).

### Make relationships understandable

| User intent | Relationship meaning | Expected behavior |
| --- | --- | --- |
| Keep material relevant to this dossier or notebook | Contextual association | The item appears in the chosen view; review and readiness status remain independently determined. |
| Refer to a source while writing a note | Note reference | Open the source and expose the note through an authorized backlink. |
| Use a passage to support an assertion | Evidentiary citation | Record the precise document version and supported page/section/text anchor; use the existing assertion review workflow. |
| Turn a follow-up into actionable work | Linked task | Where supported, create or link one real task retaining its originating note and source context. |

Keep a document, an evidence excerpt and a working note recognizable as different record types. Formatting a note, linking a file, ticking a checklist or adding an AI summary must not itself accept evidence or complete a review. Make any extraction or submission for review an explicit supported action with source lineage.

### Backlinks, versions and reliable retrieval

Add a compact **Used in** or **Linked from** section to relevant records. Show permitted dossiers, notes and assertions that reference the item, with links to their exact locations. Compute this from actual relationships rather than a manually maintained second list. Filter both entries and counts by authorization; a backlink must not grant access or reveal restricted titles or snippets.

Support direct links to notes and sources, with useful breadcrumbs and predictable behavior after rename or move. Use persistent record identity rather than display titles for relationships. Case-scoped search should include authorized notes and linked material using existing search capabilities where possible.

An evidentiary citation must retain the exact source version and anchor used in the review or report. When a newer source version appears, retain historical references and show affected current items for review under existing staleness rules. Ordinary contextual links may open the current source record if that is the product's established behavior, but the referenced and current versions must remain distinguishable when relevant.

State what is saved and shared while writing. Reuse existing draft persistence and conflict handling. Keep content that has not passed review labelled as working material, and expose the actual case/notebook sharing scope rather than implying that all notes are private. If private notes are supported, enforce that scope consistently in links, search, exports and AI retrieval.

### Implement and evaluate in bounded increments

1. Map current case, note, document, evidence, citation and task entities to this workflow; reuse their APIs and editor before introducing new models.
2. Implement one controlled case with a notebook/note, Link existing, exact source opening and return navigation.
3. Add reciprocal Used in links, safe unlinking, correct source-version behavior and the existing review handoff.
4. Exercise the full journey in the browser before extending it to more record types or cross-case source reuse.

Use a Canopy working copy: create a staffing-analysis note, link existing D09 material, open the relevant passage, return to the note, and submit a sourced assertion through the available review workflow. Link the same source into another authorized note, verify both backlinks, unlink one association and confirm that the source and other link remain. Reload the case and verify persistence.

Also verify a source update, an access-restricted backlink and a recoverable save failure. Preserve the original reviewed version and sealed output. Review desktop, narrow-screen and keyboard behavior after each increment, including unsaved note handling when opening a source.

**Acceptance:** users can assemble a dossier from existing material without unnecessary uploads or disconnected copies; follow links in both directions; distinguish contextual notes from accepted support; and retain correct versions, permissions and saved state. This stage follows the P0 reliability work and does not require recreating a general-purpose Notion editor.

## Cross-stage P0 acceptance — authenticate, save and reopen real work

Run this alongside the relevant fixes once a working signed-in environment is available. Diagnose the previous `/signin-with-chatgpt` 404 against the current host and supported authentication configuration rather than adding a placeholder sign-in route.

Verify Case Studio entry → supported sign-in → return to intended action → save → reload → sign out/in → reopen saved case. Verify organization switching, correct case scope and the affected role permissions. Use authorized controlled accounts; UI visibility alone is not evidence of server authorization.

Retain the existing policy distinctions identified in prior review, including permitted reviewer snapshot creation and writer-restricted package linking. Keep helpful permission explanations near the attempted action.

Keep first-use choices focused: create, import, open a demo or continue work. Default to Case Studio and User view; retain explicit Demo selection and Canopy's Demo placement. Explain the current step and next action in the existing guided workflow.

Measure the approximately two-minute onboarding goal from the actual first entry through registration/sign-in, opening a case and understanding the next action. Record the scenario and timing boundaries, including required external authentication or verification. A script timing is not a human usability result.

**Acceptance:** real browser evidence demonstrates persistence across sessions and correct organization scope. At least one observed first-use exercise identifies timing and friction. Native mobile verification remains a separate result from a resized desktop viewport.

## Reference use: precise and limited to the current work

Use the already reviewed Plane screenshot mapping below. These filenames and observations are attributed to the supplied review record; re-open the originals when performing the visual comparison.

| Change | Existing Plane reference |
| --- | --- |
| Queue grouping and navigation scopes | `Plane web Sep 2025 75.png` |
| Active filters, counts and reset | `Plane web Sep 2025 172.png` |
| Selected record behind a contextual panel | `Plane web Sep 2025 96.png` |
| Narrative, properties and attributable activity | `Plane web Sep 2025 104.png` |
| Scoped form and explicit save/discard | `Plane web Sep 2025 29.png` |
| Confirmation consequences and prerequisites | `Plane web Sep 2025 102.png` |
| Error feedback beside retained input | `Plane web Sep 2025 402.png` |
| Focused onboarding | `Plane web Sep 2025 6.png` |
| Purposeful empty states | `Plane web Sep 2025 193.png` |

These are dated screenshots. Their appearance does not prove the referenced product's backend behavior or accessibility.

If a specific unresolved design decision needs another example, use [Mobbin's web-app collection](https://mobbin.com/discover/apps/web/top) through the authorized account `Maxim.hayan@gmail.com` and the supported sign-in flow. Limit the search to that decision, such as preserving draft input during sign-in or presenting report-generation failure. Inspect the relevant screens, document their app, screen/flow, URL and observation, and explain the Genesis adaptation.

Additional user-selected references are [Folk flows](https://mobbin.com/apps/folk-web-eab5aa23-fe06-443e-a4b9-1e2ae69087f0/66411de5-b76c-4cff-a7d4-11e9c0bfe3ba/flows), [Notion flows](https://mobbin.com/apps/notion-web-33c9cc81-4dd5-46cd-8a0b-15d46b137668/17ff231d-68df-43ef-9952-f2a4d677318d/flows) and [Notion screens](https://mobbin.com/apps/notion-web-33c9cc81-4dd5-46cd-8a0b-15d46b137668/17ff231d-68df-43ef-9952-f2a4d677318d/screens). These are user-provided review targets. Their authenticated screenshots have not been inspected in preparing this brief. The browser connection timed out during the Notion review attempt.

The Folk direction uses [Folk's public product illustrations](https://www.folk.app/), not authenticated Mobbin interaction evidence. The Notion direction uses the official documentation cited in Stage 5 and the user's specified linking concept. Re-open the supplied Mobbin targets when access is available; attribute only actually inspected screens. Existing evidence is sufficient to begin the scoped implementation work.

## Mandatory evaluation and delivery

For each meaningful stage, record the affected user problem, source change, rendered result, interaction evidence, issues found and corrections made. Inspect desktop and narrow layouts, keyboard/focus, loading/error states and the return journey. Use focused tests for the state and permission risks affected by the change; finish the stage after sufficient evidence rather than expanding testing without a concrete reason.

Keep component simulations, real-handler tests, signed-in browser results and human/device checks clearly labelled. Preserve the current working product while resolving blocked verification; claim completion only for demonstrated outcomes.

Deliver a working review link, selected before/after screenshots, a generated controlled-case PDF, the reference-to-change mapping and this completion matrix:

| Item | Required evidence |
| --- | --- |
| Affected PDF path | Signed-in generation, open/download and content inspection |
| Save/refresh feedback | Success and controlled failure observations with accurate receipt state |
| Queue ordering and counts | Multiple real action types, filtering, completion and return |
| Deadline/citation reviews | Exact targeting, eligibility, persisted outcome and remaining dependencies |
| Connected dossier and notes | Existing-source linking, authorized backlinks, safe unlinking, pinned evidence versions, review handoff and persistence |
| Persistence and organization scope | Reload, new session, switching and denied-access checks |
| First-use/mobile | Observed timing and device/environment description |

Mark each item Verified, Implemented but unverified, or Blocked. For a blocker, state the dependency and the concrete work already completed. Report guided-demo readiness and unattended trial readiness separately. Include the observed version and environment so evidence is tied to the actual build.

Begin with current-baseline confirmation, browser recovery and reproduction of the affected PDF path, then complete save feedback and the queue/review improvements in small reviewable stages. Add the connected dossier-and-notes workflow after the P0 reliability work, using the same review discipline.

## Product-owner self-review of this proposal

| Risk in the proposal | Adjustment made | Remaining validation |
| --- | --- | --- |
| Repeating completed work | Treat the Plane archive as inspected and governed actions as existing implementation surfaces. | Confirm the current source and supplied evidence. |
| Improving appearance while a core outcome fails | Put the affected PDF journey and authenticated persistence at P0. | Verify real signed-in behavior. |
| Growing navigation and controls unnecessarily | Reuse current components, compact filters and six-action disclosure; make drawers conditional. | Compare actual task completion and context retention. |
| Misleading success after a write | Separate confirmed mutation, refresh status and unknown write outcome. | Exercise controlled failure and recovery paths. |
| Turning retirement into false case readiness | Keep dependent assertion review and output staleness explicit. | Verify readiness after the actual domain transition. |
| Creating a new backend state machine for cosmetic reasons | Require inspection and reuse of existing contracts before adding fields or endpoints. | Implement only demonstrated contract gaps. |
| Treating automated checks as customer readiness | Separate server, browser, human timing and native-device evidence. | Complete the missing evidence before claiming self-service readiness. |
| Letting reference collection delay delivery | Use the existing archive; request Mobbin examples only for a specific unresolved decision. | Attribute only screens actually inspected. |
| Building a second document store or a competing dossier hierarchy | Use the existing case as the dossier and link authoritative records within supported ownership boundaries. | Check identity, case-copy isolation and source reuse. |
| Mistaking a convenient notebook link for accepted evidence | Distinguish contextual references from versioned, anchored citations and explicit review outcomes. | Exercise the note-to-assertion review journey and source updates. |
| Exposing restricted content through backlinks | Apply permissions to backlink entries, counts, search and source opening. | Verify with a restricted case member. |

Owner conclusion: this is a focused completion and reliability iteration. Its success is a user who can identify the next action, complete it, trust its saved outcome and obtain the correct report. Broader visual changes should follow observed friction in that journey.
