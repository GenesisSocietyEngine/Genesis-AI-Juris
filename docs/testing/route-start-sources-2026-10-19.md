# Route start and source correction — 19 October 2026

Baseline: clean canonical main 0c22940, public Sites v147 (runtime 25c2aa4). Owned branch codex/route-start-sources-20261019. Preserve user case42 with unsaved edits and all existing cases.

Acceptance before implementation: Review's missing-start action must open a Trigger-specific form, explain the outgoing connection, preserve typed buffers and existing edges, and create exactly one Trigger on explicit submission. Source entry must explain missing HTTPS, offer an explicit safe correction for bare DNS addresses, retain malformed input for correction, and recompute the same strict source check. Valid URL syntax does not certify authority. Multiline editing must retain the newline while typing. Keep existing save, undo, authority and publication gates.

## Delivered — public Sites v148

Runtime merged main: `6e2910758a6f13b4bf1a65167bbc070c4a950792`; ordinary [PR 142](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/pull/142). The missing-start action now opens a Trigger-specific form in EN/RU and explains its outgoing connection. Source entry and Review share the strict source-format feedback. A bare address such as `www.nbb.be` remains visibly invalid until the user explicitly chooses **Add https:// to bare source addresses**; `https://www.nbb.be/` then clears the source-format action. Explicit schemes, credentials, malformed input and prose are not silently repaired. Accepted syntax does not certify source authority or relevance.

The textarea retains multiline typing and harmless whitespace while synchronizing actual external changes. Undo/redo and the existing draft/history/save path remain intact. No authentication, server validation, publication gate, dependency or lockfile contract was relaxed.

### Validation and review

- Focused source/composer/action/connection/playbook cohort: **28 passed**. The final state-reconciliation subset passed **8** overlapping tests; do not add these counts together.
- TypeScript and changed-component/helper lint passed. An initial effect-driven state update triggered lint; the final implementation reconciles changed source props without that effect.
- Supported exact-merged-source build passed, including tax assets, migration breakpoints, 18-route mobile parity and the Vinext build. Initial JurisApp chunk: **320,912 bytes**, above the 320,000 aim but below the unchanged 325,000 cap. Extract before further growth.
- Full built web run (`node --experimental-sqlite --import tsx --test tests/rendered-html.test.mjs tests/*.test.ts`): **1,632 tests; 1,624 passed, 5 failed, 3 skipped**. All five reported failures were environmental and passed unchanged targeted reruns: reviewed local braces fork restored as a junction after byte-for-byte verification (4 tests); two historical migration commits fetched into the shallow checkout (5 tests); long-form TEMP/TMP used for Windows Git fixture paths (4 tests). This is not a claim of one zero-failure full run.
- Browser: desktop EN and 390×844 RU; Trigger-specific title/detail/first-step controls and outgoing direction; preserved form values across locale changes; source error and correction fit narrow width; keyboard Tab/Enter correction; multiline entry; undo to bare URL and redo to HTTPS.
- Production synthetic **case 44**, “QA synthetic — route and source corrections — 2026-10-19”, saved once and independently reopened. It has **10 nodes / 9 connections**, retaining all eight original Clearpath edges and adding `Synthetic instruction received → Decision brief`. The reopened source field contains `https://www.nbb.be/` with accepted-format feedback. Both route-start and source actions disappear. The separate blank legal-date warning remains; it was not claimed fixed. User case 42, case 43 and every prior case/unsaved tab were preserved.
- Exact runtime hosted CI at closure: Rust succeeded; Root Web/PDF and iOS Native queued; Flutter, Android Native and iOS Tax running. These are pending additional gates, not a claimed all-green result. Record their terminal outcomes before closing the CI follow-up.

### Release receipt

| Field | Verified value |
| --- | --- |
| Project | `appgprj_6a88a26d2f808191aa076b9fcd8dbce6` |
| Version | `appgprj_6a88a26d2f808191aa076b9fcd8dbce6~appgver_d67ccf825e80819183c293617ee390d2` (v148) |
| Deployment | `appgdep_6ad63caa76208191b0a34333f85feb7e` — succeeded, 2026-10-19T15:52:35.403176Z |
| Audience / environment | Existing public audience; revision 42, bindings retained |
| Application inputs SHA-256 | `0024c29c5e8aeab43a543df5658061222d4c0f0a420a33081686329b3bcd0b4b` |
| Hosting inputs SHA-256 | `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe` |
| Local archive SHA-256 | `32b3f843e952e9a5280b9e73f9001be7e344b564e25c282abe71e605abe3b281` |
| Native archive-content SHA-256 | `87a9b1f5367859deef50cb64b2a5ec980111a933f97a3583f814d8a1e21078ae` |
| Archive | 49,254,400 bytes / 552 files |
| Actual predecessor | Saved v147 archive; runtime `25c2aa4831265bb99e8df8fad38f3cd53707c0a9` |
| Asset retention | 125 current + 48 retained = 173; predecessor current manifest 124 |
| Public and native origins | **173/173** status/MIME/byte checks passed on each |

Origins: [casevant.pro](https://casevant.pro) and [native Sites](https://genesis-juris-web.maxim-hayan.chatgpt.site). Static asset receipts alone do not establish hydration or persistence; the separate authenticated browser check above does. Supported source opening, exact merged build, predecessor retention, packaging, save and deployment were used. This Markdown closure does not change the deployed runtime.

### Limits and next actions

Hosted exact-source Web/PDF and remaining native workflows are still pending. JSON import/export was not reverified: the browser file chooser required extension file-URL access, which was not changed. Native deletion confirmation was abandoned in a local test; the production test changed an existing Trigger to a Fact and then added a new Trigger instead. No user case was deleted. The wider 18-package, old-client, same-tab account-transition and cross-browser matrix remains open. Preserve synthetic 44 as evidence. Follow the [updated execution plan](../development/CASEVANT_REVIEW_REMEDIATION_2026-10-19.md); do not repeat this runtime rollout for documentation-only updates.
