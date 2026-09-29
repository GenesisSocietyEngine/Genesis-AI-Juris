# Report completion authority amendment — 25 September 2026

Intended outcome: pending report generation must not download a PDF, persist its receipt or signal success after the dialog changes account/case/authority or unmounts. A valid earlier receipt remains available if another attempt fails in the same context. Report content, fingerprints, PDF renderer and sealed historical files remain unchanged.

The actual parent/helper regression was first extended to count downloads across a scope change. It failed on the previous code (6 downloads rather than 5), proving that hiding the receipt alone did not stop an old-context download.

The amended dialog resets context-bound UI during a guarded render retry and updates the asynchronous authority reference during the committed layout effect. No ref is changed during speculative rendering. The report helper accepts an optional current-context predicate and checks it before generation, after asynchronous imports/rendering, immediately before download and before optional receipt storage. Parent catch/finally callbacks remain scoped. The hook model now models render retries and separate layout/effect commit queues; it remains a model, not a browser.

Regression checks cover context switching, authority revocation, unmounting, valid newer-scope activity, explicit receipt export and retention after failed same-scope generation. No migration, hosting setting or access policy changes are made by this amendment. Authenticated human acceptance of the final review successor remains outstanding.

Independent review also found that a previously completed preview could remain visible after permission revocation. A regression reproduced this before repair. Previews are now bound to the exact receipt context and current permission; changing context hides them, revokes the prior object URL and prevents an old preview from reappearing if permission is restored. The final 23 report/PDF checks pass, and focused lint on the three amended files has no errors or warnings. The final three files are identical between production and review source trees.
