# CV-019 · Recent activities

On 10 November 2026 the signed-in MyCase walkthrough covered all six Home filters, the full history link and the Deleted history filter. Home showed six entries in its All view. The document filter narrowed the list to an upload. An empty category displayed “No recent activity available.” Rows included an actor, action, linked context, relative timestamp with an exact date, and the recorded web channel. History added deposit requests, time entries and expenses.

CaseVant Home shows six entries. View all activity carries the category into the history page, which loads older entries in batches of 30. Each row uses a recorded timestamp and shows the actor when a display name is available. Case and document links preserve organization and language. Invoice links open Billing for the authorized case. The Deleted filter compares adjacent versions of firm and case work plans to recover removed tasks and events. Voided financial entries remain journal operations.

The feed reads existing records without a migration. Case metadata follows active participant access and the selected organization. Invoice metadata additionally requires billing access in that case. Case grants and billing roles are rechecked before the response. Note bodies, document bytes and financial amounts are outside the response. A universal client channel and historical contact-to-case links are unavailable from these sources.

The SQLite regression covers created, changed, unchanged and removed work, restricted billing, revoked participation, foreign firm files and pagination with equal timestamps. The query also executed against a fresh database containing all 38 migrations. In a synthetic browser, Home switched to an empty Deleted filter and Tasks opened filtered history. Loading older activity retained the first entry. Russian history at 390 CSS pixels had one main heading, no horizontal overflow and no visible button shorter than 44 pixels.

Production acceptance is recorded below. Live restricted-role acceptance and large-organization latency remain open.

Release preparation on 11 November 2026 found a Windows long-path checkout omission before deployment. The Sites helper staged 11 omitted test artifacts as deletions. Enabling local Git long-path support and restoring those files produced a tree identical to the tested PR merge. The canonical history includes this restoration so the final CI build and saved Site version use the same commit. No incomplete archive was deployed.

## Published v211 · 11 November 2026

PR #286 initially failed both web jobs on a synchronous React loading-state update inside an effect. Moving that update to the user event handlers passed targeted lint and all 18 CI checks on `0c481efe912d0ff235a0178e48ca2162089970f0`; the PR merged as `ddb9cda59af480f67860f68295aea60d938877b3`. PR #287 reconciled the restored checkout history and release notes. The released source is `cb6f5a890e7dbd5eaaa8e0c193a2737fa872dc7d`, from successful [exact-main build 42923912772](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42923912772). Publication succeeded at 23:41 UTC on 10 November (11 November in Paris). Both origins verified 163 current plus 87 retained assets. [Receipt](receipts/recent-activities-v211.json).

Signed-in production checks used synthetic records and the existing owner session:

- English Home showed six recent rows. All six Home categories responded; Tasks → View all activity retained the category. Russian Home filters and its task-history link also worked.
- History loaded 30 rows then 33 after the older-record command in both languages, before fixture completion added further updates. All nine Russian history categories worked. Events, Deleted, deposit requests and expenses had empty results; documents, tasks, invoices and time entries had recorded results.
- Creating a firm task and editing its title produced distinct creation/update history. A fourteen-task recurrence supplied pagination data. All fourteen occurrences, the original firm task and one synthetic case task were completed afterward. Their audit entries remain intentionally retained; no task-delete control was available through the ordinary UI.
- The Russian invoice link opened Billing for the correct synthetic case with EUR 30 due. The document link selected the correct file/current version but simultaneously displayed an English unavailable-record notice. This is CV-020, not a clean document-navigation pass; existing untranslated document controls remain CV-017.
- Switching to a second organization showed empty history without personal-workspace entries. A personal case URL using the second organization's selection was rejected with “This case is no longer available.” Restoring the correct organization reopened the synthetic case. This tests organization isolation with one owner identity, not a second restricted participant.
- Signed-out English and Russian activity URLs showed the sign-in gate and no history.
- At 390 CSS pixels, Russian Home and EN/RU history had document scroll width 390, one main heading, no unnamed buttons or fields, and no visible buttons below 44 pixels. The viewport override was reset. A desktop screenshot records the released Tasks history.

Live Deleted acceptance covers its empty state only. Populated removal, restricted billing, revoked participants and tied-timestamp pagination remain isolated SQLite evidence. No second production identity or large-organization load test was available. CV-019's core release is verified with these explicit limits; CV-020 is the next document-navigation correction.
