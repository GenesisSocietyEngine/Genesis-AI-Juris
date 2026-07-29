# MOBILE TEST CHECKPOINT 1

## Scope

This checkpoint verifies the generated multi-case library, the existing Failed
ERP shell, and the first engine-backed Logistics scenario.

## Emulator test

Run from `apps/juris-mobile`:

```powershell
flutter devices
flutter run
```

Verify:

1. the app opens on **Case Library**, not directly in Inbox;
2. both fictional matters are visible;
3. both Failed ERP and Logistics show **Playable demo**;
4. the Logistics conversion sheet marks scenario definition, diagnostics, and
   deterministic path, authoritative engine runtime, and mobile bundle as
   ready, with `rust_scenario_v1` as its runtime adapter;
5. switching EN → RU changes topic, synopsis, roles, and library labels while
   party names and stable case identity remain unchanged;
6. the Logistics Start button opens **Claim intake** at Day 1, 08:00;
7. **Audit the invoice and evidence file** advances to **Pre-action recovery**
   at 10:00;
8. both Logistics outcome paths reach a terminal case report;
9. the Failed ERP Start button still opens the current demo;
10. Inbox cards remain newest-first;
11. the back arrow disposes the active native session and returns to the
    library without mixing case state.

## Real-phone smoke test

After the emulator checklist passes, install the debug APK:

```powershell
flutter build apk --debug
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

On the phone verify startup, language switching, both case-card layouts,
Logistics launch/action/outcome, background/resume, and return to the library.
Persistent saves remain a later milestone; process-local session isolation is
covered by Rust tests.
