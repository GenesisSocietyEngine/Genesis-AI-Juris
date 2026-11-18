# CV-041 — Evidence count grammar

## 18 November 2026 — implementation and local acceptance

PR #324 merged as `33f21bc` after all 18 checks passed. The clean task branch starts from that main revision; public baseline is v227 (`4c626ed7`).

English Evidence summaries previously showed “1 records” and “1 exact citations”. The shared presentation helper now selects “1 record” and “1 exact citation” only for a count of one. Zero/multiple counts, pending-proposal wording, Russian plural rules, computed collections and persistence contracts are unchanged.

The focused localization/workspace suite passed 18 tests. Count expectations cover 0, 1, 2, 5, 11, 21 and 22 in EN/RU. The actual integrated parent additionally renders returned collections of 0, 1 and 2 assertions, source anchors and pending proposals, checks rendered record cardinality, and switches EN→RU→EN with zero writes.

Local browser acceptance used the actual Evidence component and synthetic transport: all three summaries correctly displayed 0/1/2 in EN/RU. The fixture is local only; it creates no production evidence. Signed-in release checks and exact-main publication remain pending. CV-010/028/029 continue to await an active client.

## Public v228 — release and signed-in acceptance

PR #324 merged as `33f21bcbf3051d56581c3daea64e15dba30c69f4`, then CV-041 PR #325 merged as `795ddf3afc826994bd69fc6ac6375507226ffe8c`. Each final head passed all 18 checks, without a retry or bypass in this iteration. Local TypeScript and focused ESLint passed after correcting the synthetic response fixture's unknown JSON type.

Exact-main [workflow 44384668831](https://github.com/GenesisSocietyEngine/Genesis-AI-Juris/actions/runs/44384668831) passed: 2,110 tests, zero failures, three inherited skips; two HTML checks; PDF visual gates; full and production dependency audits with zero vulnerabilities. Sites source `98d12f209cff53f769415accf1861e49abb7b512` published as **v228**, deployment `appgdep_6afe043b7ff88191a8ebceb85b1931a3`, environment revision 42. Public audience and DB/R2 bindings were preserved; no migration was needed.

Both `https://casevant.pro` and `https://genesis-juris-web.maxim-hayan.chatgpt.site` returned the exact merged runtime and application digest `1c55ea7bb1f28d86c3dc785dbe9922689cad4324ce6e1ebc32d4399bb2c80715`. Hosting digest remains `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. Both origins verified all 221 assets: 166 current and 55 retained from v227. [Release receipt](receipts/cv041/release-v228.json), [custom-origin assets](receipts/cv041/assets-0.json), [Sites-origin assets](receipts/cv041/assets-1.json).

### Live count matrix

The signed-in owner checked existing synthetic cases through the normal UI. The user explicitly authorized two labelled synthetic source anchors and assertions for multiple-count acceptance.

| Population | English records / citations | Russian records / citations | Live fixture |
| --- | --- | --- | --- |
| Zero | 0 records / 0 exact citations | 0 записей / 0 точных ссылок | Existing C1 smoke case |
| One | 1 record / 1 exact citation | 1 запись / 1 точная ссылка | Existing release-audit case before additions |
| Multiple | 3 records / 3 exact citations | 3 записи / 3 точные ссылки | Release-audit case after the two authorized additions |

Intermediate English counts of two also matched the visible rows. EN↔RU switching retained the selected case and Evidence section. Both EN and RU reloads retained three assertions and three source anchors. Pending AI proposals stayed at zero live; zero/one/multiple pending-proposal populations were verified locally without creating AI jobs. [Live DOM count receipt](receipts/cv041/live-counts.json), [local browser matrix](receipts/cv041/local-counts.json), [English screenshot](receipts/cv041/live-multiple-en.png), [Russian screenshot](receipts/cv041/live-multiple-ru.png).

### Synthetic record disposition and limits

The added source anchors are `source_anchor_5f9cb5bf2de44f3496bd7dfd37dfe842` (QA 1) and `source_anchor_fdf838453da0498dbe0de8d2668e2dbb` (QA 2), tied to **Synthetic release 209 original**, version 2. Assertions `assertion_508b5cf017f249cca84fcc21f6e818da` (QA 1) and `assertion_244ea67210a84725904b26c65436e221` (QA 2) quote its synthetic title through the existing accepted source anchor. All four new records remain pending/needs review; no approval was inferred from their inclusion in a count. Preserve them as authorized QA history. The original accepted assertion, citation and AI review remain intact.

The three-minute bounded Worker log query returned one info-level canceled `/api/activity` invocation and no uncaught exception/error-level message. This is not an all-traffic health claim. The local preview was stopped; no viewport override remains. CV-041 is production-verified. CV-010/028/029 remain pending an active client; CV-009 still needs EU infrastructure evidence.
