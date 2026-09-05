# GENESIS: AI Juris v0.5.0 — Inbox Interaction Patch

This patch responds to the first Android emulator playtest.

## Changes

- Every Inbox tile is tappable across its full surface.
- Tapping a message opens a contextual detail and response sheet.
- The settlement-offer tile exposes two explicit decisions:
  - **Yes — accept EUR 64,500**
  - **No — reject the offer**
- `Not now` closes the message without changing game state.
- Generic action confirmations now use **No** and **Yes** rather than
  `Cancel` and `Execute action`.
- The demo repository can resolve acceptance or rejection so the mobile
  interaction is testable before the Rust bridge replaces mock transitions.
- Widget coverage now verifies tile interaction, explicit No/Yes choices, and
  the corrected lazy-scroll assertion for the Matter screen.

## Apply over the current repository

Copy the contents of this archive over the repository root, retaining `.git`
and the generated Android folder. Then run:

```powershell
cd C:\PROJECTS\genesis-ai-juris\apps\juris-mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter run -d emulator-5554
```

Because the app is already running under `flutter run`, copying the changed
Dart files may also be followed by `R` for a hot restart. A normal hot reload
may not be sufficient after repository state and tests change.
