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

Production acceptance remains open. Repeat both populated combinations in the released signed-in workspace and check reload, locale switching and reset.
