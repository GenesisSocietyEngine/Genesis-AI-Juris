# Studio Access & visibility layout correction

The owner supplied a hosted screenshot of the Studio Developer view on review source `773dc47714bda9288dc5e8d2be516790a727ace8`: the privacy explanation and copy-protection text were squeezed into a narrow column while the privacy toggle occupied most of the section width.

Intended outcome: readable access text, an intrinsic-width privacy toggle, a separate copy-protection row, and reachable controls without horizontal overflow at 390 CSS px. The existing permission checks, inherited protection lock, checkbox state, labels, keyboard focus and change handlers must stay intact. This is a bounded layout correction, not an access-policy or design change.

Source diagnosis: `.studio-access` has two columns (`minmax(0,1fr) auto`) and four direct children: introduction, privacy label, copy-protection control and optional Developer protection register. The latter two lacked full-row placement. Their automatic placement put the register in the same `auto` column as the privacy label; the register's intrinsic width can dominate that column. The copy control was confined to the remaining first-column width. This explains the supplied screenshot; no independent browser measurement was performed in this subtask.

The correction gives the copy control and protection register their own full-width rows. Text containers may shrink/wrap; toggles size to their content within the available width, while the visual switch retains its width. Rules are scoped to `.studio-access`. Generic label/input rules and JSX are unchanged, including the existing single-column layout at widths up to 640 px.

Independent source review confirmed the grid placement diagnosis and found no material issue in the proposed correction. It specifically retained the existing focus/disabled/min-height rules and scoped the wrapping/indicator rules to `.studio-access .privacy-toggle > span` and `> i`.

Applied as a separate correction after receipt commit `48906277711eb4220f1b9ad1dd4d310529e2428d`. Local verification: PostCSS parsed the entire stylesheet; comparison with that parent found exactly five added rules, all scoped to `.studio-access`, with no existing rule changed or removed. `app/JurisApp.tsx` remains byte-identical to published source 773. `git diff --check` passed. Final diff review confirmed the later single-column breakpoint remains effective; the scoped intrinsic toggle width overrides the generic mobile full-width rule only inside this section. Existing disabled, checked, focus and minimum-height rules remain intact. No new test or unrelated suite was added or run for this CSS-only correction.

Rendered desktop/390 px/200% and long-English/Russian acceptance remain with the authorized hosted-browser executor; this source-only review does not mark them PASS. This subtask performed no browser, network or deployment action.
