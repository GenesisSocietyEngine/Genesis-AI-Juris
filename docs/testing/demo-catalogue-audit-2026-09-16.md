# Demo catalogue audit — 16 September 2026

## Intended outcome and acceptance

One Demo cases destination contains both guided walkthroughs and decision simulations. No case is selected or opened by entering the catalogue. Templates opens empty case starters. Existing examples, exact-version simulation launches, current work and authorization boundaries remain available.

Acceptance: neutral entry; Canopy and GreenFire appear as ordinary choices with format labels; filters do not reveal an unrelated fallback; old view=library links still reach Demo; no separate Practice cases sidebar destination; template creation requires the existing replacement confirmation; asynchronous case loading cannot override a later navigation.

## Findings and amendments

- The third bundled record (GreenFire) was hard-coded as featuredId. A large spotlight and case index looked like an active case although activeScenario was null. Removed the entire spotlight, index, selected-row state and fallback selection.
- Production had already separated Templates, but still split Canopy from Practice cases. Both view=demos and legacy view=library now render the same catalogue: Canopy guided walkthrough plus five decision simulations. Format is a filter and card label, not a separate destination.
- Canopy scenario controls and source dossier load only after opening its walkthrough. Its Studio working copy and authorized governed workflow remain distinct actions inside that example.
- The private review still used Templates to open the simulation library. Ported only the dedicated template view and its nine empty starters. Preserved the review's session/navigation controller and profile-loading correction.
- Replaced generic Canopy shortcuts in My cases and Studio More actions with Browse demo cases. Fixed English/Russian catalogue labels. Production Help and training orientation are aligned with the unified catalogue.
- Independent review identified delayed simulation completion after navigation and a review shortcut bypassing departure guards. Navigation invalidates the shared launch identity; Canopy also checks it after its dynamic load. Competing launches observe busy state. The review editor shortcut uses the existing navigation risk/departure handler and blocks active analysis.

## Verification

Production: 11 focused model/render/navigation checks passed and focused lint passed. Review: 5 named focused checks passed, the existing navigation-controller assertions ran, and focused lint passed. Strict TypeScript and the 18-route canonical contract gate passed in both builds. The contract gate is not mobile browser testing.

No API handler, migration, hosting identity, authentication controller or PDF-generation change belongs to this amendment. Each Site preserves its own baseline and audience. Production does not acquire the private Track S authentication UI.

Browser interaction and responsive acceptance of the amended catalogue were not performed. The earlier managed browser preview was rejected by URL policy; no alternate-browser or direct-HTTP workaround was used. Supplied screenshots establish the reported visual problem, not verification of the new screens. Authenticated saves and actual reported-case PDF delivery remain separate acceptance work.

Native publication evidence is recorded separately after successful deployment.

The training orientation chapter now describes the unified catalogue. Updated narration, illustration, captions and transcript agree. The amended MP4 remains 600.000 seconds; complete audio/video decode passed.
