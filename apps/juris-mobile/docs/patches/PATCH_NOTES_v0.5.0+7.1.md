# v0.5.0+7.1 — Calendar hearing interaction test fix

## Fixed

- Adds a stable widget key to every calendar item row.
- Updates the scheduled-hearing widget test to target the complete tappable row instead of its text child.
- Uses `tester.ensureVisible` before tapping, preventing off-screen hit-test warnings in the default 800×600 widget-test viewport.

## Scope

This patch does not change hearing scheduling or rescheduling gameplay state. It fixes the automated UI interaction that previously attempted to tap a text widget below the test viewport.
