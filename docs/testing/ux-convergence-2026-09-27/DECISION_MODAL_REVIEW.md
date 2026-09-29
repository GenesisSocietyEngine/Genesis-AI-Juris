# Training decision dialog keyboard correction

## Intended outcome and criteria

A user opening a training action must enter its decision dialog, keep keyboard focus inside it, and return to the invoking action when cancelling. Escape may cancel the unsubmitted review; it must not bypass an in-flight dispatch or the existing result/advance step. Choices, cost, timing, recorded results and training state must remain unchanged.

## Observed failure and bounded correction

Independent browser review on the built candidate at `http://127.0.0.1:5281` reproduced: open Failed ERP Implementation → Run conflict check using the keyboard. Focus stayed on the background action, Tab moved to background Accept matter, and Escape did not close the modal. The accessible `role="dialog"` alone did not supply modal behavior.

`PlayWorkspace.tsx` now opens the existing decision content in a native modal dialog. Native modality makes background controls inert and contains sequential focus. Cleanup closes the dialog and restores the connected invoking control. Escape uses the existing dismissal boundary (`!isResult && !busy`), and changes to the busy/result state keep focus on an enabled dialog control or the dialog itself. Three scoped CSS rules preserve the existing full-screen backdrop and panel layout. No training decision or reducer changed.

## Verification

- Independent source review found no material issue in the native dialog lifecycle, busy/result focus selection, existing cancel boundary or scoped CSS. No decision, resource or result handler was changed.
- Final pinned-runtime build and both built-entry checks passed at source input digest `849295fa05be74ecc8c44d46d288637e3cc9e2910456816f7f6009e308974db2`; the relevant 62-test selection also passed. [Build](evidence/final-accessibility-build-retry.log), [regressions](evidence/final-accessibility-regressions.log).
- Actual final-built browser: keyboard Escape and the Cancel control close review and return to Run conflict check, retaining zero spend, 100 stamina, zero fatigue and zero minutes. Initial focus is inside the native dialog. Background page controls remain inert during Tab navigation. Native navigation may cycle through browser chrome, where `document.activeElement` reports BODY; no background page-control focus was observed. This is page modality, not a claim that browser chrome is trapped.
- All three retained actions completed with Tab/Enter. Result focus moves to Continue/View debrief; Escape does not skip the result step. Final settlement 64,500, spend 2,350, net 62,150, 540 minutes and metrics 48/44/47/11 match the unchanged fixture. Browser Back/Forward preserves the completed outcome. [Full browser record](BROWSER_REVIEW.md).

The reproduced local keyboard defect is closed. Real screen-reader use and hosted role/session acceptance remain separate.
