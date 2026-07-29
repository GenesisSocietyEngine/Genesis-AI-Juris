import 'package:flutter/foundation.dart';

import '../models/game_snapshot.dart';

/// Presentation boundary shared by the temporary ERP demo and future Rust
/// scenario sessions.
///
/// Widgets consume immutable snapshots and submit stable action IDs. They do
/// not know which runtime owns state transitions, so connecting a native Rust
/// transport cannot introduce scenario-specific mutation into Flutter.
abstract class GameRuntimeRepository extends ChangeNotifier {
  GameSnapshot get snapshot;

  bool get isTerminal;

  /// Whether the shared shell may send explicit time commands while resumed.
  ///
  /// The shell stops ticks while paused, backgrounded, or terminal. Supporting
  /// repositories remain authoritative over each requested state transition.
  bool get supportsLiveClock;

  void reset();

  void markInboxItemRead(String itemId);

  /// Requests one deterministic foreground-time transition.
  ///
  /// Implementations must not derive elapsed game time from the wall clock.
  void advanceTimeByMinutes(int minutes);

  ActionExecutionResult applyAction(String actionId);
}
