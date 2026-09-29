# Phase 2 — exact-candidate browser acceptance pack

Product source commit: **9236c02a294c4c9a43cd49cb3113fba06a889c6b**.
Baseline for comparison: production v86 / `dca6af234ce27c76a6b1cb22359be9540d8e5049`.

**This is an unexecuted acceptance pack.** All result cells start “Blocked / not run.” It does not constitute browser verification. An attributed human run is acceptable only against the exact candidate, with its environment and artifacts recorded.

## 0. Establish and identify the candidate

A platform-supported HTTPS candidate/test environment must serve this exact source through the supported authentication dispatcher. Current managed HTTP preview cannot establish the real sign-in journey. Do not create an application-owned `/signin-with-chatgpt`, inject authenticated headers into a browser, or deploy this unreviewed candidate to production merely to obtain HTTPS.

Record before testing:

| Field | Required value / evidence |
|---|---|
| Source commit | 9236c02a294c4c9a43cd49cb3113fba06a889c6b; verify in actual environment/deployment metadata |
| Environment URL and artifact identity | Exact URL and operator-confirmed source/artifact binding; v86 URL alone is insufficient |
| Migration state | Candidate schema through `0022_loving_juggernaut`; separate controlled data plane |
| Reviewer | Human name or agent identity; do not attribute a human run to automation |
| Browser/device | Browser version, OS, viewport, DPR; say physical device or emulation |
| Started/finished | UTC timestamps, including task timing boundaries |
| Data | Controlled Canopy working copy and synthetic case; canonical demo remains reusable |
| Accounts | Owner, contributor, reviewer, viewer; a separate organization's controlled account |
| Output artifacts | Screen recording or screenshots, case/record/revision/event IDs, report hash and failure observations; no session secrets |

If any candidate/environment binding is missing, stop the acceptance claim and record the dependency. Backend verification remains valid separately.

## 1. P0 browser checks — current candidate

For every check: inspect desktop and a 390-pixel-wide viewport, exercise keyboard access and visible focus, compare action/status text with actual saved state, fix any issue, then rerun the affected check. A narrow desktop viewport is not native-mobile verification.

| ID | Journey and steps | Pass condition | Evidence to capture | Result |
|---|---|---|---|---|
| B01 | Open normal Case Studio; inspect default User view; choose prominent Open demo case; open Canopy explicitly | Studio entry is normal; Canopy is in Demo and does not auto-open; six-step guidance has a next action; portrait map labels are readable | `b01-studio-desktop.png`, `b01-studio-narrow.png`, Canopy orientation screenshot | Blocked / not run |
| B02 | Start a supported account-required action from a controlled case with prior input; sign in/register using the real supported flow | Returns to exact organization/case/action; input remains; no `/signin-with-chatgpt` error page | Full browser URL progression and returned input screenshot | Blocked / not run |
| B03 | Save a controlled case; reload; sign out; sign in again; reopen from My cases | “Saved” only after success; exact content/revision persists across reload and session change | Before input, saved confirmation, reopened revision, API/audit evidence associated with the browser run | Blocked / not run |
| B04 | Switch organizations; open a copied protected URL as another organization and as viewer/reviewer | Correct catalogue per organization; unauthorized case content and changes denied; organization ownership alone gives no case access | Both catalogues, denied response and absence of private content | Blocked / not run |
| B05 | Open the exact historical workspace deadline; review original due date/timezone, outcome/reason/support and readiness effect; save | Original date/history preserved; valid outcome recorded; receipt and exact audit agree; queue updates only after current revision/readiness load | Exact deadline before/after, receipt, event, queue | Blocked / not run |
| B06 | On a working copy retire an accepted stale citation; inspect dependencies and current outputs; optionally propose replacement | Acceptance history and old sealed bytes remain; dependent assertions still need review; current outputs are outdated until required work and regeneration | Citation, dependent assertions, output status, old PDF hash | Blocked / not run |
| B07 | Save a disposition, then interrupt only its refresh read | Receipt stays saved; update failure is distinct; Retry update makes reads only; current actions are not claimed prematurely | Network request sequence, receipt, update-failed state, recovered queue | Blocked / not run |
| B08 | Interrupt the response after a disposition commit; close and reopen review; use Check original save | Recovery remains visible; same actor/key/record original operation is resolved; no duplicate write/audit; no new key is made silently | Original key/event/revision, recovery screenshots and request sequence | Blocked / not run |
| B09 | Switch A→B→A while a write or refresh is pending; repeat with delayed success and delayed failure | Old responses, errors and cleanup cannot update the new visit; B and new A are not stuck with a mutation lock | Recording plus selected case and control states | Blocked / not run |
| B10 | Remove access during an open review and during refresh; expire a session separately; submit an invalid reason | Denied private data/draft/receipt cleared; forbidden write is not retried; session recovery accurately describes retained input; validation focuses the real field after enabling | Denial state, session-return result, keyboard/focus evidence | Blocked / not run |
| B11 | Make conflicting edits from two sessions; compare server record and retained proposal; explicitly resubmit if appropriate | One original save wins; current/proposed values are visible; no automatic new-key overwrite | Both revisions/proposals and explicit confirmation | Blocked / not run; complete comparison UI remains pending |
| B12 | From the current sealed snapshot generate an available report; preview/open; download; reopen the same output | Correct active case/snapshot; no error page; preview and downloaded bytes agree; old sealed output remains available | Snapshot/output IDs, preview screenshot, downloaded PDF/hash | Blocked / not run |
| B13 | Interrupt preview after successful generation; interrupt generation separately | Preview failure retains secure download; generation failure retains report choices; no fake success or unrelated output | Failure/recovery screenshots and request sequence | Blocked / not run |

For B05, historical eligibility is **open + workspace + valid due instant strictly before the evaluation time**. Future/current/projected deadlines must retain their appropriate planning/simulation path. Do not modify production date guards to make a test record eligible.

The current disposition UI deliberately freezes its proposal while its outcome is uncertain. The shared changed-draft/conflict model is tested separately, but full parent-owned draft continuity across unmount/authentication and the information-request receipt UI adapter are unfinished. B02/B10/B11 must record these actual limitations rather than infer success from the model tests.

## 2. Compare workspace recovery presentation

Inspect the existing candidate first: it hides the case content area while refreshing or when confirmed-outcome refresh fails, retaining the receipt panel. Record focus, orientation, ability to understand what was saved, and clarity of the remaining work.

The proposed alternative retains the authorized case header, case navigation and read-only data with explicit “Updating” / “May be outdated” labels; stale queue counts and write controls are not presented as current/actionable. Confirmed access loss must clear that data. Implement and compare this as a bounded P0 amendment only once rendered review is available.

Accept the alternative only if it improves orientation without implying current readiness or exposing stale/private content. Capture both modes against the same controlled case and failure. **No comparison has been performed yet.**

## 3. Subsequent UI gates — not implemented in this candidate

After P0 acceptance, use the implemented models/APIs to build and review these stages separately:

| Current action point | Proposed control / destination | UI implementation needed | Completion behavior |
|---|---|---|---|
| Information-request receipt | Exact request via `requests?request_id=…`; response form scoped to that request | Use durable operation key/receipt, preserved proposal and current comparison | Confirm original request/audit/revision, refresh current readiness, restore queue state |
| Citation-dependent assertion outside first page | `evidence/assertions?assertion_id=…` | Fetch/verify/merge exact assertion before focus; keep source/action origin | Review or supersede exact assertion; return to original citation/action |
| Repeated or filtered next actions | Canonical collection and case/org queue state | Replace UI-local collection, count/filter logic and local disclosure state | Same case return preserves filter/selection/scroll; persisted completion removes the appropriate action |
| Draft working material | Notes list and focused editor in Documents & evidence | Blank/meeting/analysis; primary Save note; secondary Link existing source; retained draft/selection/scroll | Show server-confirmed revision/time; reopen exact revision/history |
| Link existing source | Bounded same-case picker, exact version, optional exact anchor | Show source status/current-vs-pinned version and already-linked state; Upload new source separately | Persist one relationship; return to note; show locator and existing secure source actions |
| Used in / unlink | Authorized document backlinks and exact note relationship | Same-case count/entries; independently operable Open source, Download and Unlink controls | Remove only selected relationship, preserve source/other notes/history, update count |
| Report prerequisite | Exact selected output preserved while opening snapshot/package prerequisite | Retain origin output/action through the prerequisite | Regenerate the intended output and return to its report/action |

API source-association responses provide relative download paths. The editor must use existing `organizationScopedUrl()` handling and server authorization; linking never grants new access. No working note is implicitly accepted evidence or part of a sealed report.

## 4. Canonical Canopy working-copy exercise

Create a fresh working copy through the available Demo flow. Confirm the actual fixture content before editing:

- **D09 v1:** cold-chain and delivery context.
- **D08 v2:** leadership/staffing confirmation.

Once the notebook UI stage exists: create a meeting note; save; link D09 v1 as context and D08 v2 as staffing support; inspect exact version/locator; open and download a source; confirm Used in; unlink only one relationship; reload and confirm the note and other relationship remain. Do not label D09 as proof of a staffing assertion.

Then complete an available supported governed case action, review unresolved evidence/dependencies, create a **current** sealed snapshot, generate the available report, and reopen that exact output. Working notes alone must not advance governed readiness or silently enter the sealed snapshot.

## 5. Timed first-use and accessibility evidence

Start the timer on the initial application entry with a controlled signed-out account. Include real sign-in/registration, opening a demo or importing supported material, and locating/understanding the next action. Stop only when the participant can state the current step and successfully open its next control. Record authentication time and task time separately as well as the total. Approximately two minutes is a goal, not an assumed result; an automated navigation-only script is insufficient.

Preserve “Import case prompt (.md)” where applicable. Exercise menus and dialogs using keyboard, click-away and Escape; inspect focus return, button semantics, text wrapping, contrast, horizontal overflow, touch targets, orientation controls and PDF A4 pages. Include a physical mobile device if available; otherwise explicitly record the limitation.

## Evidence and release sign-off

For each run attach reviewer identity, exact candidate/environment binding, actual result, artifact filenames, failures, fixes and retest references. Mark only genuinely completed layers **Browser verified**. Backend test artifacts are separate. Mark **Release accepted** only after the real authenticated save/reopen journey, permissions, report path and P0 recovery interactions pass, with no unresolved blocking findings.

After release authorization is exercised through the normal publishing route, record the deployed version/source and run a focused production smoke check. This pack does not authorize substituting an unreviewed production deployment for acceptance.
