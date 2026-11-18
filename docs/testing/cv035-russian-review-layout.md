# CV-035 / CV-040 — Evidence localization and review layout

## 18 November 2026 — audit and implementation

Baseline: public Sites v226, canonical runtime `1c33529a23f26017fc9d6efcd35157c03c9c3b2a`, Sites source `2242974054e968321f9c778a61f2c07e74acb626`. The official helper opened the current public Site before editing. The isolated task branch starts from documentation commit `ff5e55ecc0e655293a552257330415da37cbad00` (#322), preserving its v226 receipt. Existing release checkouts and unrelated work remain untouched.

The signed-in owner audit reconfirmed English generation/disclosure, manual evidence, proposal controls, source labels and audit events inside Russian navigation. The accepted proposal led with raw JSON and squeezed its note into half of a narrow card. A 390 × 844 live audit view had no horizontal overflow, but remained partly English.

### Changes and preservation

- CV-035: Russian Evidence forms, disclosures, statuses, citations, review controls, known audit events/roles and locale-specific audit dates. Saved receipts are translated at render time, including bounded generation counts; language switching does not rerun an action. Known error messages switch immediately; unknown server wording remains intact in technical details beneath a localized explanation.
- CV-040: readable statement first for known v1/legacy statement objects; original payload remains in an accessible disclosure. Unsupported/malformed/future payloads remain visible as their original text. Review notes span the full card. Available workspace width governs stacking, including with the case picker open. Source forms/registers adapt similarly. The picker title no longer breaks within a word.
- No changes to server authorization, mutation payloads, source versions, model receipts, review decisions or authored content. Language changes retain controlled review drafts and existing exact citation targets.

### Local evidence

- TypeScript check and focused ESLint passed.
- Integrated workspace, dossier UI and new localization tests: **39 passed, zero failures**. Full CI initially found a legacy source-text assertion that expected the English accessible label to be a literal. It now checks the localized call; integrated rendering separately verifies the exact EN/RU accessible citation names and targets. No product assertion was weakened.
- Real integrated parent with synthetic transport: RU→EN→RU retained an unsaved review note and edited JSON. Saved and stale notices switched immediately in both directions. No fixture POST was sent. Original JSON expanded/collapsed, statement, quotation, accepted history and provenance remained inspectable.
- Desktop 1280 px: expanded picker stacks review cards (667 px card, 629 px note); collapsed picker permits readable side-by-side cards. Phone 390 × 844: EN and RU stack cards with no document overflow (375 px document width, 301 px card). This is local component/browser evidence, not production acceptance.
- Screenshots: [expanded RU](receipts/cv035-cv040/local-expanded-ru.png), [mobile RU](receipts/cv035-cv040/local-mobile-ru.png).

### Integration and live gate

PR #322 merged as `e3a5547b70b00f62b1b7446dfe97370ef5e802aa` after all 18 checks passed. PR #323 then merged as `4c626ed7b587965addb99e3b55354a3d411a99ad`, also after all 18 checks passed. Its final web workflow [44334435588](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44334435588) passed 2,108 tests with zero failures and three inherited skips, two HTML checks, and both dependency audits with zero vulnerabilities.

CV-032 monitoring: #322 needed an editor-restart retry after launch timeouts and a smoke retry after a Flutter download timeout. #323's smoke [44334435242](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44334435242) timed out booting the Simulator; attempt 2 passed. No CI requirement was weakened, and these infrastructure symptoms are not attributed to the web change. Exact-main release workflow [44343090286](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44343090286) remains the publication gate.

Additional local EN→RU→EN checks preserved the generation/manual version selections, assertion type and unsaved manual statement, with zero fixture writes. CV-010/028/029 still require an active test client; no new invitation or production review mutation is part of this iteration.

### Remaining audit finding

CV-041 · P3 · English Evidence singular counts: the existing English summary can say “1 records” or “1 exact citations”. Russian plural handling is covered by this change. Follow up with English singular/plural formatting without changing counts or record meaning.

## Public v227 — production acceptance

18 November 2026: exact-main workflow 44343090286 succeeded: 2,108 web tests passed, zero failed, three inherited skips; both HTML checks passed; full and production dependency audits reported zero vulnerabilities; PDF visual gates passed. The official Sites helper published source `def9484f988ae7e71ba4acf6e9e83347993d9cbe` as v227, deployment `appgdep_6afdd02765788191b42f22cb6c20966e`, environment revision 42. Public audience and DB/R2 bindings were preserved. No migration was needed; v226 remains the compatible predecessor.

Both `https://casevant.pro` and `https://genesis-juris-web.maxim-hayan.chatgpt.site` returned runtime `4c626ed7b587965addb99e3b55354a3d411a99ad`, application digest `bd4df3c57cdee17142d97f501e159b320903eab2e9a411ab8c19cd0167a0a441`, and hosting digest `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. All 222 assets passed byte/MIME/status verification on both origins: 166 current plus 56 retained from v226. [Release receipt](receipts/cv035-cv040/release-v227.json), [custom-origin asset receipt](receipts/cv035-cv040/live-assets-custom.json), [Sites-origin asset receipt](receipts/cv035-cv040/live-assets-sites.json).

Signed-in owner acceptance used the existing accepted proposal in **CaseVant release audit · synthetic · 2026-11-10**, with **Synthetic release 209 original**, version 2. The assertion/proposal/source IDs, statement, raw JSON, quotation and QA review note matched the pre-release DOM capture exactly. The readable statement now leads; original JSON remains inspectable by mouse/keyboard. The exact-source link focused `source-source_anchor_cbb6101229894248b1ef5b08d1493a64`. All nine audit entries preserved order and attribution while labels/dates switched EN/RU. Evidence survived reload in both locales. No production generation, review, invitation or other write was performed.

Desktop review with the case picker expanded is readable and stacked; collapsed picker permits wider use of the workspace. At 390 × 844 in both locales, document scroll width was 375 px and the review card approximately 302 px, with no horizontal page overflow. Review notes span the card. [Live Russian desktop](receipts/cv035-cv040/live-expanded-ru.png), [live Russian mobile](receipts/cv035-cv040/live-mobile-ru.png). Temporary viewport overrides were reset and owned local previews stopped.

The bounded five-minute Worker error query returned four **canceled**, info-level `/api/work` or `/api/activity` invocations from the Sites-origin browser renderer; it returned no uncaught exception or error-level message. This is a bounded observation, not a claim about all production traffic.

CV-035 and CV-040 are production-verified for this scope. Immediate saved/error-notice translation and unsaved draft/selection preservation were tested against the actual integrated local component with synthetic transport; live acceptance used read-only accepted history. CV-010/028/029 still await an active test client. CV-041 and recurring CV-032 infrastructure symptoms remain tracked separately.
