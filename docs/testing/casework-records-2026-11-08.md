# Case register, document templates and prospect stages — 8 November 2026

Base: public v197 and canonical main 012b2d43. Read-only reference: MyCase [Word Templates](https://maxima-consult.mycase.com/documents?template=true), [Cases](https://maxima-consult.mycase.com/court_cases) and [Manage pipeline](https://maxima-consult.mycase.com/leads/statuses). The reference exposes Word templates and merge fields, independent Case Stage and Status Update columns, and lead stages. No client record, template content or vendor asset was copied.

| User outcome | Evidence before publication |
| --- | --- |
| Author a reusable template and generate a Word brief on the intended case. | In the synthetic browser workspace, an incomplete case named both missing fields and disabled Save. After a stage update, the same template merged the case title, firm, stage and update; review and confirmation enabled Save. The case document reopened in the Library and produced a browser Word download. The D1 route test unpacked the OOXML and checked escaped text, the package relationship and the original text after the template and case changed. |
| Track daily case progress separately from formal decisions. | The register showed formal status Draft and stage Review side by side. A dated update appeared in history. Route tests compared existing dossier, participant and binding rows before and after; competing writes were rejected. Prior updates and generated documents reject in-place modification and deletion. |
| Return to a personal selection. | Named a stage filter, reloaded, selected the saved view and verified the case and filters. Tests cover personal visibility, archive/restore, auditors' own views and denied cross-person edits. |
| Track prospects without granting access. | Edited a synthetic prospect from New inquiry to Consultation, filtered to the new stage, and confirmed the contact still had no linked cases. A pre-stage client editing a prospect preserves the saved stage. Choosing a different relationship clears it. |
| Keep context and recover saves. | Register → Library → Contacts retained the selected case. Controller tests cover template and case revision changes, discarded authority, exact receipts after an uncertain save, and Save and continue. A Studio identifier alone does not select a governed case. |
| Keep desktop and narrow layouts usable. | Verified English desktop and Russian in a 390 px browser frame. Template/update commands measured 44 px; document scroll width equalled available width. Closing the case editor returned focus to its opening command. |

Final visual review aligned the register heading with Library and replaced field codes in reading panes with localized field names. The editor still supports precise field insertion. Reviewed and saved text is not reinterpreted as template syntax.

Migration 0032 adds one append-only table with four kinds of records and no changes to previous tables. A populated v197 fixture includes questionnaire versions, a saved answer, CRM links and stored document history; every existing table's rows survived migration unchanged. The 18-test practice-route suite and both new controller tests passed locally. An independent Word document reader reopened the generated package and recovered all paragraphs, Cyrillic text, XML special characters and a tab.

Scope: these are reusable plain-text templates with controlled merge fields and genuine .docx output. Importing rich Word layouts, electronic signatures, external client intake, custom pipeline configuration and multi-anchor workflow rebasing are separate work. Operational stage and generated text do not approve evidence, change governance, or give access to a case. Production verification is recorded separately from synthetic write testing.

## Production acceptance — v198

[Implementation PR #259](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/259); merged source `3c71c990c05d6917b9d81c8b5efd653b56748c8d`; [exact-main run](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/42520768953). The main build and unchanged 47-report PDF baseline passed. Both production origins served the same source and all 212 verified assets. Existing D1 and document-storage bindings, audience and environment remained unchanged. [Release receipt](receipts/casework-v198-2026-11-08.json).

Signed-in live navigation retained the saved Studio case across the case register, overview, Studio and Library. The real template library loaded, and closing the empty template editor restored focus without saving. Generated document and CRM writes, Word download and governed case history were tested with the isolated synthetic fixture described above.
