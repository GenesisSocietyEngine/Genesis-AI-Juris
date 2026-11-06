# UI reference audit and saving clarity — 6 November 2026

## Baseline and reference

Canonical main fb23bbf6aec809a3c2dc007deca2315d08e941b7 is clean and contains v190 runtime c66826d0f63062e2284036f3ff0f7902138ab250. Sites confirms public v190. This task owns branch refactor/ui-audit-save-clarity. Prior user tabs and every real case remain preserved.

Fresh signed-in MyCase inspection: dashboard quick actions and grouped daily-work widgets; Cases register with stage and next task/event; built-in SAMPLE John Doe case with bounded summary and local sections; Edit Case with explicit Cancel / Save & close. Opened and canceled the editor unchanged; focus returned to Edit Case. No reference record, vendor asset or private data is imported. Reference routes: https://maxima-consult.mycase.com/dashboard and /court_cases/51865796/info. These observations establish UI behavior, not backend parity.

## Findings and acceptance before implementation

1. **High — contradictory save/leave state.** The Studio header confirms the structured case snapshot, while its departure guard independently treats any unsent prompt or unadded evidence as unsaved. The screenshot therefore can show a saved timestamp and an undifferentiated discard warning simultaneously. Show exactly what remains unsaved; keep prompt and working-item buffers distinct from durable case content. Never imply Save stores those buffers or apply AI automatically.
2. **High — no safe saving choice in departure dialog.** Add Save and continue only when every outstanding change supports confirmed persistence. Continue only after the exact save receipt, unchanged authority/intent and a fresh clear guard check. Failure, conflict, later edits, remaining buffers, changed case/account or uncertain response must keep the user in place. Review unsent work must open its actual control. Keep explicit discard and sign-out behavior.
3. **Medium — modal placement and emphasis.** Center the dialog, constrain height/width, preserve keyboard focus and equal-height commands; emphasize saving rather than destructive discard. Check narrow English/Russian text and Escape.
4. **Medium — case workspace hierarchy.** At 1280×720, the case navigation starts at y807.75, following repeated status/readiness material. Collapse secondary checks by default while keeping a readable attention summary. Put Case overview and AI Studio together with exact organization/case return context. Keep section selection and dirty departure guards intact.
5. **Low — exposed machine labels.** Render stored case-type keys as readable labels without modifying their persisted identifiers. Technical diagnostics remain collapsed.
6. **High — case context lost between suite destinations.** The Studio Case overview tab opened the firm-wide `/work?view=cases` list. Both overview and Studio must switch the current editor in place, keeping its prompt, draft and graph. Cross-module return links must retain the exact saved Studio ID and governed return context while explicit case/organization changes drop the old hints. A governed dossier ID never becomes a Studio custom-case ID.

## Verification plan

Use focused controller/actual-handler tests for save continuation, status distinctions, authority/intent races and buffer retention. Exercise actual components in isolated synthetic browser previews: save success, failure, concurrent edit, prompt-only state, review action, explicit discard, keyboard and 390px layout. Review case hierarchy at equal viewport and preserve editor cancellation. Run required candidate and exact-main web/PDF CI, adopt the exact CI artifact, retain only v190 current assets, publish through existing Sites configuration, verify both origins and read-only signed-in production UI. Maintain current_progress.md at each milestone. Broader Library/CRM/finance/portal/sync/native acceptance remains separate.

## Implemented and reviewed

- Studio's status explicitly distinguishes confirmed case content from unsent prompts and unadded working items. The timestamp only describes confirmed content. Save does not silently apply a prompt, add evidence, or grant approval.
- The centered departure dialog names outstanding changes, offers Save and continue only for supported changes, keeps Stay first, and gives unsent input a direct Review action. Explicit discard remains available. Failed/uncertain saves, later edits, changed authority or intent and guard replacement refuse automatic departure; duplicate activation writes once.
- A first-save browser test found the continuation reading React's previous pending flag. Confirmed receipt/state updates now commit together before the continuation checks current risk. A successful actual application save reaches Calendar with `studio_case=51`; a synthetic conflict leaves the case open. No persistence schema or server permission changes.
- Studio's overview/workbench tabs and active Studio rail entry are local commands. Calendar and other suite links carry an authorized-on-open saved-ID hint, panel/step, organization and governed return path. The shared Case overview tab resolves the current case when one is present. Tests cover explicit case/organization fences and first-save link rebinding.
- Secondary case checks are collapsed, the case picker collapses on narrow screens when a case is selected, and a case-level Overview / AI Studio pair preserves the exact selected dossier's return path. Machine type keys become readable labels; the case title is the selected workspace's sole H1.

## Evidence before publication

- 86 focused checks pass, including actual save handlers, departure/history/authority behavior, workbench, save-status presentation, context round trips and case editor. Strict TypeScript passes; targeted lint has zero errors with seven pre-existing unused-variable warnings in JurisApp.
- Real application local preview (`preview-save-clarity.mjs`) uses synthetic transport only. Overview → AI Studio → Overview → AI Studio retains the literal unsent prompt, title and 14-record/13-connection Canopy structure. Ordinary Save confirms case content while explicitly retaining the prompt warning. Departure lists only that prompt; Review focuses `studio-case-brief` with the original value. No provider call is available in this preview.
- Actual dialog: centered at desktop 1280×720, Stay initially focused, keyboard Tab reaches Review. Russian 390×640: dialog width 358.4px, height 459.2px, three 44px buttons, document width 375px (no horizontal overflow), Escape closes the dialog. Local screenshots are synthetic UI evidence, not production write acceptance.
- Actual case component at 1280×720 places sections at y476.9, compared with the live pre-change y807.75; fixture data and surrounding shell differ, so this is not a controlled percentage comparison. At 390px the case picker is closed, document width is 375px. Edit opens focused on the name; Cancel returns focus to `case-edit-command`; zero synthetic case writes.
- The full local suite ran in the sandbox: loopback Worker requests failed with EACCES and temporary Git repositories could not write config. It is not a passing release run. Required clean candidate/exact-main CI will supply the authoritative full web/PDF result. No test or protection is relaxed to accommodate the host sandbox.

Publication and fresh production verification remain pending. Existing native, source-acquisition, historical-artifact and wider module limitations remain separate.

Final journey amendment: Back/Forward between panels of the exact same mounted Studio also stays local. The exemption allows only panel/step/hash changes (normalizing the default Studio view); different saved IDs, organization, locale, examples or suite views still use the existing guard. Actual history tests retain the prompt without reload and leave beforeunload protection enabled.
The explicit Return to your case footer now uses the same context-preserving link builder; its governed dossier stays exact and its saved Studio return hint survives.

Actual browser Back returns to Workbench with the literal prompt unchanged and no dialog; Forward returns to the same overview with no reload or discard. Final navigation regression set: 18/18 pass.

The first candidate CI completed PDF baselines but reported two outdated route expectations: an active Studio entry was still asserted to be a reload link, and a generic governed-evidence destination excluded the new Studio return hint. Updated those assertions to require the in-place command and exact return hint while retaining absence of a governed dossier/custom-case association, organization-change refusal, and ordinary guarded links from other views. Full final-head CI is rerun; the failed run remains recorded as 2007 passes, two failures, three inherited skips (plus two passing HTML checks).
