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

  /// Whether the shared shell should advance this runtime every foreground
  /// clock tick. Declarative Rust scenarios advance through authoritative
  /// action costs and therefore return false.
  bool get supportsLiveClock;

  void reset();

  void markInboxItemRead(String itemId);

  void advanceTimeByMinutes(int minutes);

  ActionExecutionResult applyAction(String actionId);
}
