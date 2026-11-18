# CV-041 — Evidence count grammar

## 18 November 2026 — implementation and local acceptance

PR #324 merged as `33f21bc` after all 18 checks passed. The clean task branch starts from that main revision; public baseline is v227 (`4c626ed7`).

English Evidence summaries previously showed “1 records” and “1 exact citations”. The shared presentation helper now selects “1 record” and “1 exact citation” only for a count of one. Zero/multiple counts, pending-proposal wording, Russian plural rules, computed collections and persistence contracts are unchanged.

The focused localization/workspace suite passed 18 tests. Count expectations cover 0, 1, 2, 5, 11, 21 and 22 in EN/RU. The actual integrated parent additionally renders returned collections of 0, 1 and 2 assertions, source anchors and pending proposals, checks rendered record cardinality, and switches EN→RU→EN with zero writes.

Local browser acceptance used the actual Evidence component and synthetic transport: all three summaries correctly displayed 0/1/2 in EN/RU. The fixture is local only; it creates no production evidence. Signed-in release checks and exact-main publication remain pending. CV-010/028/029 continue to await an active client.
