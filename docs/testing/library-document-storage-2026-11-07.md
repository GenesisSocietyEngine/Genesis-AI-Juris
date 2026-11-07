# Library storage follow-on — 7 November 2026

The task began on clean canonical `e2474c4`, public v191. A fresh signed-in MyCase audit found separate Case/Firm documents, an explicit no-case destination, folders, compact version counts, upload choices and visible sharing scope. No MyCase record changed; its firm area was empty, so a populated firm/version history was not observed.

During synthetic acceptance, a concurrent contributor integrated and released PRs 248–251. The v191-based prototype is superseded and excluded from this change; its 35 focused passes and synthetic browser exercises are **not** release evidence for the final implementation. Reopened the source through Sites on clean canonical `e82792ee47b82e7fc4144ea4d4ca6be1cc811d69`. Public v193 runtime is `9187f0a75b76858f8ec3cdd4a455ee1a025574f5`. Fresh authenticated read-only inspection verified the existing firm collection, upload dialog, pilot acknowledgement, disabled empty upload and Cancel return focus. No production upload, AI request or case edit.

## Intended outcomes and review criteria

- Extend the deployed `firm_document_versions` collection and `firm/…` private objects in place. Preserve all earlier versions, prior API clients, case evidence, Studio, Home and Calendar. Do not introduce a competing document store.
- Make the upload destination, save status and recovery action explicit; check a lost response without resending bytes. Reopen incomplete uploads from the same account and organization. Prevent duplicate/conflicting commits and overwriting of stored originals.
- Keep Case overview and AI Studio adjacent and reachable from Library, with the exact saved case and governed return. Show usable original/version history and meaningful folder actions with consistent Outlook controls, EN/RU labels and keyboard/narrow-screen support.
- Verify additive migration against populated v193 data, actual authorized D1/R2 handlers and adverse upload/authority cases. Older workers can continue to read/write existing document versions. A frontend rollback leaves new metadata in place; never drop data. Preserve audience, environment, D1/R2 bindings and the previous verified current assets.

The cumulative progress report uses the original 31 August–1 September development journal and dated canonical history thereafter, including the September history integrated during later reconciliation.
