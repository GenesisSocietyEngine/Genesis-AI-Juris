# GENESIS: AI Juris v0.5.0 — Mobile Shell

v0.5.0 moves the project from a terminal-only prototype to a smartphone-first product surface.

## Added

- Flutter application under `apps/juris-mobile`;
- Material 3 dark navy/gold visual identity;
- adaptive `NavigationBar` / `NavigationRail` shell;
- Inbox, Matter, Calendar, AI Associate, and Career destinations;
- immutable mobile `GameSnapshot` read model;
- deterministic local demo repository for UI playtesting;
- action review and confirmation sheet;
- budget, evidence, workload, fatigue, strain, ethics, and trust visualizations;
- settlement offer and deadline presentation;
- widget tests for boot, navigation, and action application;
- Windows bootstrap, run, and debug-APK scripts;
- Flutter analysis/test GitHub Actions workflow;
- branded logo asset and mobile-specific documentation.

## Boundary preserved

The Flutter demo is not a second production simulation engine. It exists only to validate interaction design. v0.5.1 will connect Flutter to Rust through a narrow API that returns immutable snapshots and accepts action IDs.

## APK status

The repository contains everything required to generate current Android scaffolding and build a debug APK on a machine with Flutter and the Android toolchain installed. The release archive itself does not contain a prebuilt APK because this build environment has no Flutter SDK or Android SDK.
