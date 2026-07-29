# MOBILE TEST CHECKPOINT 1

## Scope

This checkpoint verifies the generated multi-case library and the existing
Failed ERP gameplay shell. It does not yet certify generic Rust gameplay on a
physical device.

## Emulator test

Run from `apps/juris-mobile`:

```powershell
flutter devices
flutter run
```

Verify:

1. the app opens on **Case Library**, not directly in Inbox;
2. both fictional matters are visible;
3. Failed ERP shows **Playable demo** and Logistics shows **Outline**;
4. the Logistics conversion sheet marks scenario definition, diagnostics, and
   deterministic path as ready, but shows no runtime adapter;
5. switching EN → RU changes topic, synopsis, roles, and library labels while
   party names and stable case identity remain unchanged;
6. the Logistics Start button is disabled;
7. the Failed ERP Start button opens the current game;
8. Inbox cards remain newest-first;
9. a hearing action is unavailable until a formal hearing exists;
10. terminal play shows a clear case outcome/closure;
11. the back arrow returns to the library without mixing case state.

## Real-phone smoke test

After the emulator checklist passes, install the debug APK:

```powershell
flutter build apk --debug
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

On the phone verify startup, language switching, case-card layout, launch,
background/resume, and return to the library. Save isolation is not certified
until the next multi-save/runtime milestone.
