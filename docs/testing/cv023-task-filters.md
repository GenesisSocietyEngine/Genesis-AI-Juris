# CV-023 · Task filters across cases and leads

## Signed-in comparison, 15 November 2026

In MyCase Tasks, selecting a potential case with Me, Incomplete and Open returned one intake task. Selecting the sample case with the other filters unchanged returned three case tasks. The selector grouped cases and potential cases. MyCase also displayed due-date and unread controls.

On public CaseVant v215, the named case and All completion statuses returned one completed task. Switching to Russian preserved that selection. The queue already supported named assignees, unassigned work, completion and due-date filters. The case selector offered firm work and cases. Lead tasks had no owner field, and the queue lacked a personal shortcut and lifecycle filter. The unread control is outside this task-retrieval comparison because CaseVant has no per-user task read receipt.

## Candidate behavior

Lead tasks use the existing organization work plan. Staff choose a prospect in the task editor. The lead ID survives completion, retries and edits from older clients. The server validates new associations against the current organization's active prospects in the write transaction. Case tasks continue to require case access. A prospect linked to a case does not automatically own the case's tasks.

Closed covers closed, archived, declined and cancelled cases, and leads marked not pursuing. Historical tasks remain associated with an archived or converted prospect. Firm-only tasks have no lifecycle. All work and Everyone remain the defaults. Task filters follow the current browser history entry across reloads and locale changes and are scoped to the selected organization and actor.

## Candidate verification

| Browser action in the synthetic signed-in workspace | Observed result |
| --- | --- |
| English · select the intake lead, open cases and leads, Me and open tasks | One result, “Call prospective client” |
| Reload, then switch to Russian | Same lead, open lifecycle and Я. One intake task |
| Russian · select Synthetic case 2, closed cases and leads, and completed tasks | One result, “Review supporting documents”, marked Завершено |
| Switch back to English | Same case, Me and one Completed result |
| Clear filters | All tasks, all work, Everyone and 18 open results across the workspace |

The task-scope, practice-route, practice-plan and firm-work-controller suites passed 36 checks. They cover receipt replay, stale revision conflicts, organization isolation, invalid lead IDs and preserving lead ownership when an older editor completes a task.

## Public v216 · 15 November 2026

[PR #299](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/299) merged with 18/18 checks. The [merge build](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/43667719265) passed both web and PDF jobs for `3c53a5ddc5fbff0a16242f0ed8c21ad71cba6164`. Sites published v216 from hosting commit `ddd5a261d7067419a0c7ea8b73b4d4f60b946bc8`, with the same Git tree. Deployment `appgdep_6af91aee44f48191b80d15dee860a504` succeeded. Both casevant.pro and the native Sites origin matched 221/221 assets (164 current and 57 retained).

| Signed-in production check | Observed result |
| --- | --- |
| Lead, open lifecycle, Me, Open | The synthetic prospect originally had zero tasks across all statuses. Created one labeled release-check task. Exactly one row matched. |
| Reload in English, then switch to Russian | The same lead, assignee, lifecycle, status and row survived both actions. |
| Complete the release-check task in Russian | It disappeared from Open and reappeared under Completed for the same recipient and prospect. It remains completed. |
| Case, open lifecycle, Completed | Me returned zero. Everyone returned the existing unassigned completed task. Reloading in Russian and switching back to English preserved that row and the selections. Closed lifecycle returned zero for this open case. |
| Reset separately in English and Russian | Both restored all tasks, all work, everyone and open status. The original single open task was visible across the two accessible cases. |

The signed-in workspace had an open case with a **completed task**. The positive **closed case** combination was checked in the populated candidate fixture. The production check used the existing case lifecycle.
