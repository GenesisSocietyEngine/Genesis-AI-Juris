# Case Studio product and UX development recommendations

Prepared 1 October 2026 for the product owner, design lead and engineering team.

Case Studio's next commercial milestone should be a reliable, understandable journey from a relevant example to a saved case and a report that a colleague can review. The supplied status establishes substantial calculation and preservation evidence, while explicitly leaving hosted account journeys, accessibility and mobile acceptance open. Invest first in closing those gaps and measuring activation. Broader feature expansion should follow evidence that target users can complete the existing workflow independently.

The deployment and test figures below are claims from the supplied status report, not re-audited release certifications. This task separately implements Templates and category examples on canonical main. It does not certify production identity, mobile release readiness, PDF accessibility or pilot usability.

## Product decisions from the status report

Web production v105 is reported deployed from reviewed source `073a638`, merged into main through PR 79. Treat publication, full mobile acceptance and pilot readiness as three distinct decisions. Passing engine parity and large PDF cohorts support technical confidence; they do not establish accessible operation or successful account-backed use.

Position the product around explaining a decision through connected inputs, evidence, assumptions and review. Avoid selling a generated report as an approved professional opinion. The valuable commercial outcome is a reusable, reviewable case package with continuity across sessions.

My proposed initial audience is small advisory and in-house teams preparing tax or operational decision packages. This is a market hypothesis to validate with interviews and observed use, not an established customer segment. Keep the broader nine-category library discoverable while testing one clear acquisition message for each target segment.

## Delivery order and acceptance

| Priority | Development recommendation | Proposed accountable role | Acceptance evidence |
| --- | --- | --- | --- |
| P0 before an external pilot | Complete a production provider identity journey: create, edit, calculate, save, terminate browser, sign in again, reopen, change an input, produce both tax and economic reports, reopen history. | Web engineering lead with QA | Authorized provider account on the hosted custom domain; exact saved inputs and fresh result; report and JSON receipt agree; lost responses and failed login preserve work. |
| P0 before an external pilot | Present calculation, saving and approval as separate states. Explain stale results and missing rates beside the inputs. | UX lead with calculation engineer | A user can identify what changed and what action restores a current result. Changed inputs cannot appear alongside a previously current output. Unsaved guest work has an explicit next action. |
| P0 before an external pilot | Complete keyboard, focus, zoom and spoken accessibility across the core web journey and reports. | Accessibility lead | Actual keyboard and screen-reader operation in EN/RU; visible focus and recoverable errors; no trapping; accessible equivalent when a PDF cannot be read. PDF tags and reading order receive separate verification. |
| P0 before mobile release | Close iOS future-format refusal and real interrupted-write recovery. Keep Android physical-device acceptance open while emulator-only instructions apply. | Mobile lead | Byte preservation, explicit refusal, restored state and freshly recomputed results. Interruption occurs during the real write operation; fixture backups alone do not qualify. |
| P1 now | Make Templates easy to scan and provide a worked case for every registered category. | Product designer with web engineer | Nine numbered tiles, nine matching examples, meaningful outputs, search and filter coverage, draft protection, narrow and Russian layouts. Implemented in this candidate. |
| P1 after core hosted acceptance | Conduct moderated usability sessions with actual target participants. | Product owner with researcher | Observe unassisted example selection, own-case creation, stale-result recovery, save/reopen and report explanation. Record task success, help needed and critical misconceptions. |
| P2 after pilot learning | Develop team review, template reuse, administration and adoption reporting. | Product owner with platform lead | Evidence that teams need these workflows; explicit roles, reviewer actions and version lineage; agreed commercial packaging. |

Resolve safety-of-work defects and incorrect result states immediately. Improvements to discoverability can progress while provider and mobile gates remain open, provided release claims preserve those limits.

## Templates design

Use a semantic numbered list styled as tiles. Numbering helps orientation and support discussions; it does not imply that categories are sequential steps or ranked by importance. Retain the registry number when filtering so a reference such as template 04 remains stable.

Each tile presents the category name, a short task description, its intended output, preparation questions behind a disclosure, and two explicit actions: Use this template and Open worked example. The first produces an empty starter with intake questions; the second opens synthetic content in a working copy. Never place both actions inside a clickable card wrapper. Preserve text selection, independent button focus and predictable keyboard order.

Use two columns where the available space supports readable cards, then one column on narrow screens. Wrap long titles and button labels. Aim for 44 CSS pixel control height as a product design choice. WCAG 2.2 AA specifies a 24 by 24 CSS pixel target minimum with exceptions; the larger product target is not itself a complete accessibility certification. Test text resizing to 200% and reflow at 320 CSS pixels, along with keyboard order, contrast and focus visibility. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Use a single brief announcement for meaningful news, such as the availability of category examples. Page-specific guidance belongs near the choice it explains. Avoid rotating announcements, repeated badges, unsolicited focus changes and urgent alert semantics for ordinary release news. The current implementation uses a labelled aside, with polite announcements reserved for the changing search count. This follows the principle of sparse, relevant notices in the [GOV.UK notification guidance](https://design-system.service.gov.uk/components/notification-banner/).

The implemented search checks localized category, description and output text. Future iterations can add task synonyms from observed searches, saved favorites and last-used templates. Nine categories do not justify a dense filter toolbar on Templates. The separate Demo catalog retains format and other filters.

## Demo coverage and editorial quality

| Registry category | Added fictional case | Learning objective |
| --- | --- | --- |
| general_advisory | Harbor supplier pilot | Compare a conditional pilot with deferral; identify missing acceptance evidence. |
| litigation_strategy | Northline disputed deliveries | Separate disputed amounts from proven receipt evidence and procedural assumptions. |
| contract_review | Cloudbridge SaaS renewal | Connect problematic clauses to negotiation positions and residual risk. |
| tax_planning | Orchard investment economics | Compare illustrative cash-tax amounts and lifecycle costs; distinguish calculation from tax eligibility. |
| compliance | Clearpath vendor controls | Distinguish a policy checklist from evidence that a control operated. |
| tax_compliance | Meridian cross-border reporting | Assign missing pricing support, local obligations, reporting owners and confirmation steps. |
| erp_incident | Atlas duplicate postings | Trace containment, evidence preservation, root-cause hypothesis and regression verification. |
| investigation | Beacon expense approvals | Keep contradictions and unsupported allegations separate from supported findings. |
| training_simulation | Signal incident response | Compile and explore two branches, then explain why evidence preservation affects recovery. |

Every example contains a scenario record, unresolved issue, fictional evidence dossier, owner, internal review checkpoint, decision and two contrasting outcomes. Teaching amounts are synthetic. No current-law status, professional approval, actual statutory deadline or cached tax result is invented. Tax examples remain explicitly subject to source review and fresh calculation.

These are initial worked Studio drafts, not nine practitioner-approved legal case studies or nine published catalog simulations. The training example compiles into a branching scenario in Studio; existing published simulations and Canopy remain available through their existing paths. A richer second edition should add inspectable source attachments, annotated report samples, downside variants and a facilitator guide after the report/profile journey is validated.

Add a required coverage check whenever a category enters the registry. Editorial review should verify distinct scenario content, accurate labels, graph validity, source limitations, output availability, EN/RU parity and mutation isolation. Examples should never inherit another user's saved identity or overwrite a draft without the existing protection.

## State wording and next actions

| State | Proposed user-facing message | Next action |
| --- | --- | --- |
| Unsaved guest draft | Your work is available in this tab. Sign in to save and reopen it later. | Save through a verified account; show any available export route. |
| Changed source or input | Inputs changed since the last calculation. Recalculate to update these results. | Keep inputs visible and offer Recalculate; retain the prior result only with a clear stale label. |
| Missing required rate | Add and confirm the required rate before calculating this comparison. | Identify the exact field, jurisdiction and period; preserve the draft. |
| Unsupported future document | This document uses a newer format. Its original content has been preserved. | Offer recovery/export and compatible-client guidance; refuse unsupported edits. |
| Report prepared | Preliminary report prepared from the current calculation. Professional approval is separate. | Preview, inspect assumptions, download and locate the matching receipt. |

These messages are recommendations for a subsequent implementation slice; this candidate changes Templates and example launch wording. Use the actual engine's field validation and recovery state to select messages. Do not turn an assumed zero rate into a valid calculation.

## Commercial measurement and packaging

Instrument template viewed, template selected, example opened, first meaningful edit, calculation succeeded, verified save completed, case reopened and report delivered. Record category, locale, anonymous/session identifiers where permitted, result state and duration; exclude case facts, prompt contents, financial amounts and report text from routine adoption events. Define event ownership and deduplication before counting conversion.

Measure the example-to-own-case transition and the verified-save-to-reopen transition separately. A high demo-open rate with few saved cases can indicate unclear next steps, authentication friction or insufficient perceived value. Do not interpret it as willingness to pay without participant evidence.

Proposed pilot targets, to agree after a baseline: at least 80% unassisted completion of the core task, median first meaningful result within 10 minutes, zero observed accidental loss of work, and no participant mistaking a synthetic or preliminary report for professional approval. These are operating hypotheses, not measured outcomes or statistical proof from a small pilot.

Test packaging around three needs: individual preparation and reusable case history; team evidence review and approvals; organizational access, governance and administration. Keep the value explanation close to the relevant action. Avoid pricing claims or quotas until costs, usage and willingness to pay are measured. Track calculation and report delivery cost, support contacts per activated account and time saved in preparing a reviewed package.

## Pilot and release decisions

Start external usability work only after the hosted core journey and work-preservation gates are demonstrated with authorized access. Recruit actual target participants and include accessibility needs, both locales where served, and novice as well as experienced users. Agent walkthroughs and trained QA are useful verification evidence but cannot replace these participants.

Use the pilot to decide whether category breadth assists acquisition or creates choice overload. Keep the current nine categories intact while testing page order, task-oriented copy and segment-specific entry links. Gate broader commercial launch on repeatable hosted completion and resolution of critical usability findings. Mobile release continues to require its own device and recovery acceptance.

Detailed technical verification and remaining limitations for this candidate are recorded in `docs/testing/templates-demo-coverage-2026-10-01.md`.
