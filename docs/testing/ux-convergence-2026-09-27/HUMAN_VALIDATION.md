# Human validation protocol — UX A17

**Status: NOT_RUN. Participants recruited: 0 recorded. Sessions conducted: 0. Invitations sent by this preparation: 0.** This is an executable protocol and blank record sheet, not a completed study, video, expert panel or approval. The runbook's five-person sample is for finding UX problems; it does not establish market demand or statistically reliable conversion.

Resumed-record check, 2026-09-27: the existing packet contains no completed participant records. The prior independent agent's local browser review is engineering evidence, not one of these five human sessions. This update preserves the protocol and blank results; it sends no invitation and does not assert that no study exists outside the inspected packet. The current user request to proceed and historical claims about prior clarification remain distinct from the instructions in the attached runbook.

## Participants and preparation

The product owner/research coordinator selects at least five new participants from the intended professional advisory/decision-review profile. Record relevant experience and prior exposure to this UI; existing trained QA actors may support technical tests but cannot silently stand in for new-user comprehension. Use P01–P05 in shared evidence rather than unnecessary personal information.

Use only already authorized participation, ordinary authentication and synthetic/approved de-identified data. Recruiting, invitations, account/role grants, recording and any external session require their applicable existing authorization; this document sends or grants none. If participants are unavailable, retain A17 NOT_RUN and continue independent technical work. Do not substitute agents or fabricated results.

Before the round, the coordinator records:

- Exact candidate source/build/deployment, environment/URL, date and facilitator/observer.
- Fixture A reference Canopy and separate working copy; fixture B empty advisory case. Record current IDs/versions and expected real source fragment. Use a small synthetic source and an authorized ordinary session for Save/export.
- Participant profile, prior exposure, language, actual device/viewport/zoom, assistive technology if used, and permission for observation/recording. Do not collect credentials in notes.
- A neutral starting page and equivalent task materials for each participant. Verify that the environment works technically first; do not teach the route or pre-open its answer.
- Where actual exported files will be retained and opened, and who preserves/deletes study data under the agreed handling policy. No sensitive client material.

Facilitator opening: “Use the application to complete the tasks on the cards. Work as you normally would and explain what you expect if you wish. We are checking the interface, not your expertise. I will record when you need help; you can stop at any time.” Do not describe the navigation path or explain draft versus approval before its task.

## Task cards and scoring

Start the timer when the card has been read and the participant can act; stop at demonstrated completion, abandonment or the recorded cutoff. Record task start/end UTC plus duration and each hint's timestamp/exact words. If help is requested, first ask what they expected; any directional help makes the task **assisted**, even if eventually completed. Keep failed/abandoned attempts in the denominator. A technical outage is separately marked and reported, not discarded to improve the score.

| Task | Neutral instruction shown to participant | Demonstrated success / recording rule |
|---|---|---|
| T1 | “Open the Canopy example. Explain its proposed decision and show one piece of material supporting it.” | Real conclusion/limitation identified and correct source reached, unassisted within 90 seconds. Record actions and any mistaken source/approval interpretation. If not complete at 90 seconds, mark the timed target missed and permit continued exploration, recording total time. |
| T2 | “Find something in this case that still needs checking. Show what you would do next.” | Identifies a genuine unverified assumption/gap and its relevant next action, without treating material presence as review completion. |
| T3 | “Create a new case for the supplied synthetic advisory question and add the supplied material.” | Appropriate supported structure and actual synthetic content appear; no accidental edits to the reference fixture or fabricated smart recommendation. |
| T4 | “Save your work, leave this view, and find the same case again.” | Same intended saved identity/version/content recovered after the ordinary return/reopen route; participant can explain where it is stored. Do not count local-only recovery as confirmed server Save. |
| T5 | “Obtain the requested [Base / Medium / Full analysis] report for this case and open the file.” | Requested format/tree setting and draft/audience match; actual file opens. Record assigned format before the task. Human success is not inferred from download-start text or receipt alone. |
| T6 | “Is this result approved for professional use? Explain what tells you that, and who, if anyone, has approved it.” | Correctly distinguishes preliminary draft, evidence review and independent outcome approval using actual state. No approval is granted merely to complete the task. |

For a consistent first round, choose the same report format and synthetic task brief for all five before starting. Record the choice below. The technical A12 matrix separately checks every format/tree combination; a five-person study is not substituted for that coverage. Predetermine any timebox for T2–T6 and record it before the round; no task limit is invented after seeing the results.

## Proposed thresholds and decision separation

- At least **4/5** complete T1 unassisted within 90 seconds.
- At least **4/5** complete the combined T3→T4→T5 create/save/reopen/export journey without directional help; all three tasks must succeed for one participant to count.
- **5/5** correctly distinguish preliminary versus approved outcome at T6.
- **Zero silent data-loss incidents**. Every reproduced P0/P1 in an obligatory scenario is fixed and retested; human confusion is recorded even if engineering tests passed.

These are proposed usability targets from the runbook, not achieved metrics. Report exact counts and all failures/interventions. A17 remains separate from A01–A16 technical candidate acceptance. Its current NOT_RUN does not by itself block completing technical iterations or imply that a new general production approval is required. External pilot GO still requires actual human validation and the remaining applicable professional/data/access/operational gates. A small UX study is not a legal or professional approval.

## Round header — blank

| Field | Value |
|---|---|
| Round / date / candidate source and deployment | NOT_RUN |
| Environment / fixture IDs and versions | NOT_RUN |
| Facilitator / independent observer | Not assigned in this document |
| Target profile / eligibility / recruitment authorization | Not recorded |
| Common report format and tree setting / T2–T6 timeboxes | Not selected |
| Observation/recording/data-handling agreement | Not recorded; no recording claimed |
| Round result / findings / next iteration | NOT_RUN |

## Participant results — blank

Use `unassisted success`, `assisted success`, `failed`, `abandoned`, `technical block` only after observation. Store elapsed time in each task cell with a link to its event record. A blank cell is never PASS.

| ID | Profile / prior exposure / device | T1 ≤90s | T2 | T3 | T4 | T5 | T6 | Hints / errors / data loss / evidence |
|---|---|---|---|---|---|---|---|---|
| P01 | Not assigned | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | No observation |
| P02 | Not assigned | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | No observation |
| P03 | Not assigned | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | No observation |
| P04 | Not assigned | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | No observation |
| P05 | Not assigned | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | No observation |

Per-task event template: `participant | task | start UTC | end UTC | elapsed seconds | actions/errors | hint time and exact wording | expected | actual | result | evidence | finding ID`. Record later success after assistance without converting the original unassisted failure.

Round summary template: `T1 unassisted ≤90s: —/5; T3–T5 unassisted: —/5; T6 correct: —/5; silent loss: unmeasured; incomplete/blocked sessions: —; open P0/P1: unassessed`. Never enter zero incidents as a measured result before sessions happen.

Group findings by cause, prioritize concrete changes, then perform independent changed-flow review and targeted retest. For another first-impression round, use new participants; label returning participants as trained. Preserve prior failed observations and versions. [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md) and [UX_REQUIREMENTS.md](UX_REQUIREMENTS.md) retain the technical/human scope distinction.

The coordinator records any eventual pilot decision separately in `RELEASE_DECISION.md`. Preparing this protocol does not establish recruitment authorization, professional approval, production publication or external-pilot GO.
