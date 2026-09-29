# Help, training and Studio navigation — 16 September 2026

## Intended outcome and release boundary

Users can learn the canonical-file workflow, distinguish demos from reusable starters, create a new draft, and reach the main Studio actions through expanding navigation groups. This increment is based on exact production v89 (`bee5364094fc2074df0c4e796d27fc68cfe56507`). It does not promote Track S, B1 or C. It adds no migration and changes no API handler, database schema, provider authentication or PDF-generation code.

Expanded navigation is explicitly enabled by AppNavigation in Studio/public authoring views. WorkspaceNavigation on organization/account/Canopy pages retains the exact v89 navigation through LegacyGenesisNavigation (function name only changed). Its separate authenticated sidebar acceptance remains outstanding. New scoped CSS must not affect that legacy rail.

## Review and corrections

1. Replaced the simulation-first Help landing with clear start actions, training, task guides, practice brief and troubleshooting. The old two/three-minute claims and obsolete Five Flats calculations were removed from active Help.
2. Templates now uses the nine existing case-type playbooks to create an empty draft and intake questions. It copies no demo facts, graph, protection or saved identity. Replacement requires the existing current-work confirmation.
3. Demo owns Canopy and a single link to the complete Practice cases catalogue. Duplicate Canopy entry was removed from that catalogue's hero. Existing playable cases remain reachable.
4. Studio navigation uses native expandable groups, child action labels, selected location, a bounded mobile disclosure, Escape focus return and minimum 44 px controls. Account/organization destinations open separately to preserve the Studio tab.
5. Independent review found and corrected narrow-screen account links being hidden, mobile layout conflicts, More-menu clipping, missing saved-draft selection, standalone training contrast, delayed file-picker activation, pending-operation replacement and stale-import callbacks. The pending-operation latch clears on unmount and preserves an uncertainty notice instead of trapping future navigation.

## Training deliverable

Exactly 600.000 seconds, 1920×1080 H.264/AAC, 8,498,426 bytes, faststart. English synthetic narration is complete and unaccelerated.96 WebVTT cues follow measured sentence timings. Transcript, poster, practice Markdown and reproducible renderer sources are included.

The video is a narrated illustrated walkthrough: one actual opening screenshot,16 explicit workflow illustrations and3 account-instruction segments. It is not an end-to-end screen recording or browser-acceptance evidence. The complete canonical file was reviewed for content; it is not republished as a download. A separate fictional supplier-change prompt is downloadable and clearly marked ordinary text, not a canonical graph export.

The example uses the supplied final Five Flats, Three Borders identity (also known as Three Countries),23 nodes and 36 relations. Financing inputs follow that file:£1million acquisition,£800,000debt,7.5%,120-month amortization,£249,600gross annual rent. No return or tax benefit is asserted. Canonical integrity, professional approval and future-dated source metadata remain separate concepts.

## Verification and limits

- Eight focused model/render/navigation checks passed. Strict TypeScript passed through the build gate; canonical mobile lock retained 18 deterministic routes (not device testing).
- Media duration, codecs,faststart,complete decode,caption timing and complete speech were checked. Focused lint passed. All 20 scene layouts were reviewed; media evidence is in training-media-verification-2026-09-16.json.
- Browser observed the existing Studio entry and provided the opening capture. Later internal preview access was rejected by browser URL policy. No workaround was attempted. Updated browser interaction,mobile 390 px, 200% zoom,authenticated save and actually delivered Five Flats PDF remain unverified.
- Production publication must use the native existing Site and preserve its public audience,environment and migrations. Keep v89 as the unchanged-schema application recovery point. Native publication evidence is recorded separately after completion.
