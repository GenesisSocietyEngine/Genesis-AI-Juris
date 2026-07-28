# GENESIS: AI Juris — v0.5.0+3 interaction integrity patch

This patch fixes two playtest defects in the Flutter demonstration shell.

## 1. One-shot expert and AI assignments

- `Commission independent ERP expert` now performs a real deterministic demo transition.
- The expert action disappears after commissioning and stale repeated submissions cannot change cost, time, or inbox state.
- `Ask AI associate for damages model` records the `knownFactsRevision` it analyzed.
- The identical damages task disappears until future evidence changes that revision.
- General AI legal research is also not regenerated after intake when it already analyzed the same facts revision.
- New repository-level regression tests protect all three rules.

## 2. Interactive deadlines

- Every deadline row is now visibly clickable.
- Tapping a deadline opens a Material bottom sheet with title, due time, status, and professional detail.
- Opening a deadline does not silently complete it.
- A widget regression test verifies the interaction.

## Installation

Extract this archive into:

`C:\PROJECTS\genesis-ai-juris\apps\juris-mobile`

Allow the files to overwrite the existing copies, then run:

```powershell
dart format .
flutter analyze
flutter test
flutter run -d <PIXEL_DEVICE_ID>
```

## Files changed

- `lib/data/demo_game_repository.dart`
- `lib/models/game_snapshot.dart`
- `lib/screens/calendar_screen.dart`
- `test/widget_test.dart`
- `pubspec.yaml`
