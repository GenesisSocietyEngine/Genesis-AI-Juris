# Padding and historical pagination cause analysis — 21 October 2026

## Verified baseline

Opening local/canonical main `4d981566c4a43200d4ddeefb29396c31761cc10e` is clean. Fresh native Sites read confirms public v158, owner access, https://casevant.pro. Application digest remains `2888183313eaffe123009b8a29ca2473863d3f4a236773494320206589b02945`; hosting digest remains `20c4899db37316b7bf0bddf07ec2e526afe531e09808c9a2e22d0298a7d63ebe`. This slice changes isolated acceptance code only. All production cases and the rejected stale writer are preserved; no case write or user-tab reload is performed.

Neither historical incident is declared resolved by passing repetitions. The definite new correction is a diagnostic serialization defect. Application padding correction still requires original failure geometry; pagination requires a received failing activation.

## Padding cause analysis

Retained exact-main run39559539193 fails after legacy Import, authenticated VM discovery and four successful phases. It is a widget constructor assertion, distinct from discovery/deadline failures. Its stack and screenshot are later than the original failing frame.

Pinned Flutter3.44.8 constructs AnimatedPadding only in Material and Cupertino dialogs. Material Dialog adds viewInsets to explicit/theme/default inset padding. The current import dialog uses default positive padding; there is no application MediaQuery override or negative inset theme. Invalid derived inset data is therefore a plausible cause, but its values and original stack are missing. Non-finite numbers can fail the same assertion; do not investigate only finite negative values.

The original synthetic system log contains keyboard-hide geometry (291-point height,0.25-second animation) near the failed action, not the Dart inset at the assertion. The [pinned engine keyboard implementation](https://github.com/flutter/flutter/blob/3.44.8/engine/src/flutter/shell/platform/darwin/ios/framework/Source/FlutterViewController.mm#L1717) forwards presentation/spring geometry during animation. This supports inspecting transient keyboard metrics, not declaring an undershoot proven. Preserve the SDK and animations; do not clamp without the captured failing boundary.

### Definite diagnostic correction

The snapshot previously retained NaN/infinity. Native logs and integration responses encode JSON, which rejects those numbers. A new regression fails before correction because publication remains null. Diagnostic serialization now represents non-finite numbers explicitly as strings, retains finite negative values exactly, bounds nested containers/depth/strings and forwards identical original FlutterErrorDetails. It never repairs application metrics or suppresses the exception. Failure acceptance remains false.

The legacy-write journey also performs three labelled synthetic focus/Cancel dismissal probes before its original Import. No import command or calculation may occur in those probes. The original six phases, single real import, full carrier comparisons, save/reopen proof, source/nonce/bundle checks and deadlines remain intact. This targets the observed keyboard/route boundary; it does not claim Cancel caused the historical incident. Actual Mac execution is pending for this candidate.

## Pagination cause analysis

Distinguish: input never reaching the control; received press losing its click during rendering; handler starting a cursor read subsequently cancelled. The delivered requested-depth correction covers the third path. Passing original-v158 and production observations do not identify the historical untraced miss. The user's manual-versus-audit answer remains Not sure.

A temporary local experiment used actual catalogue/navigation components with synthetic transport. It scheduled normal verification on trusted More pointerdown with an immediate session response. Down/up/click still reached More; the cursor read began; later verification aborted it; fresh reconstruction completed48. Thus it did not reproduce removal before click. Trace: `.artifacts/pre-click-revalidation-experiment-20261021.json`.

An initial command after reload found no More because normal return-depth restoration had already loaded48. No received pointer event exists for that command; it is not a product failure. Normal Search restored25 before the measured action. Experimental fixture changes were removed and the owned preview stopped. No guessed catalogue patch ships.

Next capture target/hit/viewport/focus and delivered input, then loading/cancellation/request/response. Keep fixture, original artifact and production evidence separate. Do not introduce production analytics or inspect credentials/storage to manufacture the missing trace.

## Validation checkpoint

Pinned Flutter diagnostic/import/driver cohort:20 pass/0 fail; static analysis passes. Pagination/navigation/packaged cohort:33 pass/0 fail. Initial command mistakes (misplaced new import, incorrect driver filename) were corrected; those failures are not passing acceptance. Restricted tsx startup failed before tests; the authorized runtime run passes. The intended pre-fix serialization assertion fails separately.

Exact-main4d98156 web/PDF, Flutter, Android and Rust pass at this checkpoint. Native editor39577989927 is in progress; iOS smoke39577990046 is queued. Candidate CI is separate. Inspect genuine framework evidence before an application patch. If no failure appears, retain the exact unresolved cause. Unchanged web/hosting inputs reference the existing v158 receipt; no duplicate Sites publication is justified.
