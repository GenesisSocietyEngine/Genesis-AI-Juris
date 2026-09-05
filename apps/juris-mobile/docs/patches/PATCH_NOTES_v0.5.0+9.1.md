# GENESIS: AI Juris v0.5.0+9.1 — Source consistency repair

This repair supersedes the broken mixed-source installation of v0.5.0+9.

## Fixed

- Restores the complete `DemoGameRepository` class, including `markInboxItemRead`.
- Restores the v0.5.0+9 `GameSnapshot` constructor and `copyWith` contract.
- Restores the matching Inbox integration in `home_shell.dart`.
- Restores the matching regression test suite.
- Replaces the malformed or partially overlaid source files that caused parser errors and cascading missing-parameter diagnostics.

## Important

Do not manually add the reported constructor parameters. Those diagnostics were cascading errors caused by a malformed or version-mismatched source file.
